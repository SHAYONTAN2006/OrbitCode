variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "orbitcode"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDRs for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for the two subnet pairs"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "workspace_bucket_name" {
  description = "Globally unique S3 bucket for OrbitCode workspaces"
  type        = string
  default     = null
}

variable "orchestrator_image" {
  description = "Full ECR image URI for the Orchestrator"
  type        = string
}

variable "gateway_image" {
  description = "Full ECR image URI for the Execution Gateway"
  type        = string
}

variable "runner_image" {
  description = "Full ECR image URI for the Runner"
  type        = string
}

variable "orchestrator_cpu" {
  type    = number
  default = 512
}

variable "orchestrator_memory" {
  type    = number
  default = 1024
}

variable "gateway_cpu" {
  type    = number
  default = 512
}

variable "gateway_memory" {
  type    = number
  default = 1024
}

variable "runner_cpu" {
  type    = number
  default = 512
}

variable "runner_memory" {
  type    = number
  default = 1024
}

variable "desired_orchestrator_count" {
  type    = number
  default = 1
}

variable "desired_gateway_count" {
  type    = number
  default = 1
}
