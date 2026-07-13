########################################
# Remote state — S3 (versioned, encrypted) + DynamoDB state lock.
# These values are not secrets (bucket/table names, region), so they are
# safe to commit. The bucket and lock table themselves must be bootstrapped
# once, out-of-band, before `terraform init` (see infrastructure/README.md)
# — a Terraform backend cannot create the storage it depends on.
########################################

terraform {
  backend "s3" {
    bucket         = "pdms-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "pdms-terraform-locks"
    encrypt        = true
  }
}
