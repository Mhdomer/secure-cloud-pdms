########################################
# CloudWatch monitoring — application log group, metric filter, and three
# metric alarms (failed logins, ALB 5xx error rate, RDS CPU) at the exact
# thresholds specified in chapter-4 Section 4.3.8.6, plus a single-pane
# dashboard (chapter-3 Section 3.3/3.4.4 Sprint 4 deliverable).
#
# Alarms notify the SNS topic already provisioned by modules/cloudtrail
# (aws_sns_topic.trail) rather than creating a second topic — that topic's
# ARN is passed in via var.alarm_sns_topic_arn.
########################################

data "aws_region" "current" {}

########################################
# Application log group — the EC2 IAM role (modules/ec2/main.tf) already
# grants logs:CreateLogGroup/CreateLogStream/PutLogEvents scoped to
# arn:aws:logs:...:log-group:/${project}/${environment}/* — this name falls
# inside that pattern so no IAM change is required for the app to write
# here. Winston (src/backend/src/config/logger.js) emits JSON to stdout in
# production; the CloudWatch Logs agent on EC2 tails stdout into this group.
########################################

resource "aws_cloudwatch_log_group" "app" {
  # checkov:skip=CKV_AWS_338: 90-day retention is the explicit project audit
  # retention requirement (CLAUDE.md / chapter-4 Section 4.3.8.6 / NFR-08),
  # matching the same documented baseline used in modules/cloudtrail and
  # modules/alb, not an oversight.
  name              = "/${var.project_name}/${var.environment}/app"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = var.tags
}

########################################
# Failed-login metric filter — matches the structured JSON line the backend
# emits on every failed login attempt: { "event": "LOGIN_FAILED", ... }
# (src/backend/src/controllers/authController.js). This must fire on every
# failed attempt, not only on account lockout, for the 5-in-5-minutes
# threshold below to be meaningful.
########################################

resource "aws_cloudwatch_log_metric_filter" "failed_logins" {
  name           = "${var.project_name}-${var.environment}-failed-logins"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "{ $.event = \"LOGIN_FAILED\" }"

  metric_transformation {
    name          = "FailedLoginAttempts"
    namespace     = "PDMS/Security"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "failed_logins" {
  alarm_name          = "${var.project_name}-${var.environment}-failed-logins-5min"
  alarm_description   = "5+ failed login attempts within 5 minutes — chapter-4 Section 4.3.8.6 threshold."
  namespace           = "PDMS/Security"
  metric_name         = aws_cloudwatch_log_metric_filter.failed_logins.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [var.alarm_sns_topic_arn]
  ok_actions    = [var.alarm_sns_topic_arn]

  tags = var.tags
}

########################################
# ALB 5xx error rate — chapter-4 specifies a *rate* ("above 1%"), not a raw
# count, so this is a metric-math alarm over target-group 5xx count vs total
# request count rather than a flat threshold on HTTPCode_Target_5XX_Count.
# Guarded against divide-by-zero when there is no traffic in the period.
########################################

resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-5xx-rate"
  alarm_description   = "ALB target 5xx error rate above 1% — chapter-4 Section 4.3.8.6 threshold."
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "e1"
    expression  = "IF(m2 > 0, (m1 / m2) * 100, 0)"
    label       = "Target5xxErrorRatePercent"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = var.target_group_arn_suffix
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = var.target_group_arn_suffix
      }
    }
  }

  alarm_actions = [var.alarm_sns_topic_arn]
  ok_actions    = [var.alarm_sns_topic_arn]

  tags = var.tags
}

########################################
# RDS CPU — sustained above 80% for 5 minutes.
########################################

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-high"
  alarm_description   = "RDS CPU above 80% for 5 minutes — chapter-4 Section 4.3.8.6 threshold."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [var.alarm_sns_topic_arn]
  ok_actions    = [var.alarm_sns_topic_arn]

  tags = var.tags
}

########################################
# Dashboard — single-pane view tying the three alarm metrics together with
# CloudTrail log-delivery volume, per chapter-3 Section 3.3/3.4.4's
# "CloudWatch dashboard configuration" Sprint 4 deliverable.
########################################

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}-security-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Failed Login Attempts (5 min sum)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            ["PDMS/Security", "FailedLoginAttempts", { stat = "Sum", period = 300 }]
          ]
          annotations = {
            horizontal = [{ label = "Alarm threshold (5)", value = 5 }]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB Target 5xx Error Rate (%)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            [{ expression = "IF(m2 > 0, (m1 / m2) * 100, 0)", label = "5xx rate %", id = "e1" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { id = "m1", visible = false, stat = "Sum" }],
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { id = "m2", visible = false, stat = "Sum" }]
          ]
          annotations = {
            horizontal = [{ label = "Alarm threshold (1%)", value = 1 }]
          }
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "RDS CPU Utilization (%)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [{ label = "Alarm threshold (80%)", value = 80 }]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "CloudTrail Log Delivery Volume (incoming events)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Logs", "IncomingLogEvents", "LogGroupName", var.cloudtrail_log_group_name, { stat = "Sum", period = 300 }]
          ]
        }
      }
    ]
  })
}
