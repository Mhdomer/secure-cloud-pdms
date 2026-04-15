

  
# 1. **Narrow down the scope ( focus area )**

* narrowed down the system to only focus on  **( Secure Patient Data Management System )**


* In the revised scope, stated explicitly that the project will excluding complex modules like Hospital Billing, Pharmacy Inventory, and Emergency Room (ER) management


* **New Proposed Title: *Design and Deployment of a Secure Cloud-Based Patient Data Management System using a Three-Tier Architecture on AWS***

  
---

# **2. How to measure the secure cloud? The proposed solution remains unclear**

  
**I will add a Security Metrics to measure the secure cloud, the secure cloud will be measured using metrics like** 

* Access control validations ( IAM ROLES and RBAC ) role based access management

* Network isolation and data layer security in the private subnets

* Data encryption at REST and TRANSIT using AWS KMS

* Vulnerability scanning results from SonarQube, Trivy and Checkov, owsap  in the devsecops pipeline

* monitoring and logging via aws services like cloud watch, cloudtrial and external services Prometheus \& Grafana for metric and alerts

* Compliance Audit: Measure the system against a HIPAA-compliance checklist using AWS Security Hub

* Recovery Time: Measure how fast you can redeploy the entire environment using Terraform after a simulated "ransomware" wipe

  ---
  
# **3. Clarify the stakeholder**

  
**this clinic stakeholder currently uses a manual, on-premises server and serves as the model for your "ransomware-resilient" design**

  
The primary stakeholder for this project is a private healthcare provider, namely Alamin Clinic (Saudi Arabia), which is used as a case study to guide the system design and requirements.
The system is intended to support key users including doctors, administrative staff, and patients, ensuring secure management of patient data and healthcare operations

---

# **4. Clarify uniqueness What is the different between the one you proposed?**

  

* Many AWS arch exist but what makes them different is the ability to design and build a sophisticated arch based on the business needs where AWS offers a large amount of services from AZ, VPC to storge and monitoring, aws doesn't grantee security as per policies ( system security and design is maintained and set up by the customer )  
  
	**"The AWS Cloud enables a *shared responsibility model*. While AWS manages security of the cloud, you are responsible for security in the cloud. This means that you retain control of the security you choose to implement to protect your own content, platform, applications, systems, and networks no differently than you would in an on-site data center."**

###### **My system is combination between**


* **Saas** ( web app, users, software delivered over the internet as a service, no worries about the internal infostructure)

* **Iac Infrastructure as a Service** ( The system is built and deployed on cloud infrastructure using Infrastructure-as-a-Service (IaaS) provided by AWS, with additional DevSecOps practices for automation and security. )

* **Automation** using Devsecops and shifting left principles and security by design mindset  

	* System will also focus on automated recovery utilizing Iac blueprint to deploy the system instantly in cases of ddos attacks, the architecture is provisioned entirely via Code (IaC), meaning the security groups and private subnets are hard-coded to prevent the manual human errors that caused the stakeholder's previous breach

  
  ---
  
# **5. Better has specific hospital to make as a case study**

  
***Case Study (Alamin Clinic)***

  
  ---
  
## **More on the uniqueness of the system**  

To address the examiner's comment regarding how your proposed architecture differs from standard AWS templates, you must emphasize that your project is not merely a "static setup" but a security-integrated lifecycle.

The primary difference lies in the move from Functional Design (how it works) to Security-by-Design (how it is protected and recovered). Use the following points to satisfy your objectives and justify your specific approach:


#### **1. Integration of DevSecOps into the Infrastructure Lifecycle**


Standard AWS architectures are typically deployed once and managed manually or through simple scripts. Your proposal differentiates itself by making security proactive rather than reactive:

* **Automated Scanning:** Unlike standard setups, your architecture is passed through a GitHub Actions pipeline where tools like Trivy and Checkov scan the code for vulnerabilities before the infrastructure is even created.

* **Hardened Blueprints:** By using Terraform (IaC), your architecture is an "immutable blueprint". If the system is compromised (e.g., by the ransomware mentioned in your background), the entire environment can be wiped and redeployed to a "known-secure" state in minutes.

  
#### **2. Multi-Layered "Defense-in-Depth" Networking**

  
While many basic AWS architectures use a VPC with public/private subnets, your proposal adds specific layers of logic required for SECR (Security/Cybersecurity) standards:

* **Dual-Layer Firewalling:** You are implementing both Security Groups (stateful) and Network ACLs (stateless) to control traffic flow between layers. This provides a secondary layer of protection if a single security group is misconfigured.

* **Total Data Isolation:** The database layer is not just in a "private subnet"—it is strictly restricted to only accept traffic from the application layer on specific ports, with zero direct route to the Internet Gateway.

  
#### **3. Specific Resilience Against Ransomware**

Standard architectures often focus on high availability (uptime). Your proposed architecture focuses on Data Integrity and Recovery specifically for healthcare:


* **Encryption Strategy:** You are implementing Encryption at Rest (AES or KMS ) and Encryption in Transit (TLS/HTTPS) as mandatory core elements, not just optional add-ons.

* **Monitoring and Audit Trails:** Through CloudWatch and CloudTrail, you are designing a system that logs every action within the environment, which is critical for identifying how an attack started—a feature often missing in simpler setups.


#### **4. Addressing the Objectives Directly**

  
You can explain that while "standard" architectures exist, your project is a validated implementation that satisfies your academic objectives:

* **Investigation (Obj 1):** You are not just using a template; you are investigating why certain network segmentations fail and how cloud security concepts apply to healthcare specifically.

* **Evaluation (Obj 3):** You are proposing a method to measure the effectiveness of this architecture through security scanning and performance stress-testing, which a standard template does not provide.

  
|**Feature**|**Standard AWS Architecture**|**Your Proposed Solution**|
|---|---|---|
|**Deployment**|Often manual or basic scripts.|**Fully Automated via Terraform (IaC)**.|
|**Security**|Added after the system is built.|**Shift-Left Security** (scanned during CI/CD).|
|**Recovery**|Long manual rebuilds after an attack.|**Instant Redeployment** from a secure blueprint.|
|**Data Protection**|Basic private subnets.|**Hardened Network ACLs + Private RDS Isolation**.|
