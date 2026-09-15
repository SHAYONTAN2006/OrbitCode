# OrbitCode AWS Infrastructure

Terraform configuration for the OrbitCode cloud-native code execution platform.

## Architecture

```text
Internet
   |
   +-------------------+
   |                   |
API ALB           Execution ALB
   |                   |
Orchestrator        Gateway
ECS Fargate         ECS Fargate
   |                   |
   +---- S3        Private Runner
                    ECS Fargate
```

Terraform provisions the static AWS infrastructure. The Orchestrator dynamically launches one Runner Fargate task per Repl using `ecs:RunTask()`.

## Prerequisites

- Terraform >= 1.6
- AWS CLI configured
- Docker images pushed to ECR
- An AWS region/account with permission to create VPC, ECS, ALB, IAM, S3, ECR and related resources

## Deploy

```bash
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

Copy `terraform.tfvars.example` to `terraform.tfvars` and fill in your image URIs.

`terraform.tfvars` is ignored by Git.

## Destroy

```bash
terraform destroy -var-file="terraform.tfvars"
```

Terraform may require the workspace S3 bucket to be emptied before destruction if `force_destroy = false`.

## Important

- Runner tasks are NOT created as an ECS service. The Orchestrator launches them dynamically.
- Runner tasks are placed in private subnets with public IP disabled.
- Runner security group only allows port 8080 from the Gateway security group.
- The NAT Gateway and ALBs are intentionally provisioned because they were part of the original OrbitCode architecture and provide the same networking model.
- No static AWS credentials are stored in Terraform or container environment variables.
