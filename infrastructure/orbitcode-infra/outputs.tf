output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnets" {
  value = aws_subnet.public[*].id
}

output "private_subnets" {
  value = aws_subnet.private[*].id
}

output "workspace_bucket" {
  value = aws_s3_bucket.workspace.bucket
}

output "api_alb_dns" {
  value = aws_lb.api.dns_name
}

output "execution_alb_dns" {
  value = aws_lb.execution.dns_name
}

output "orchestrator_task_definition" {
  value = aws_ecs_task_definition.orchestrator.arn
}

output "gateway_task_definition" {
  value = aws_ecs_task_definition.gateway.arn
}

output "runner_task_definition" {
  value = aws_ecs_task_definition.runner.arn
}

output "runner_security_group" {
  value = aws_security_group.runner.id
}

output "orchestrator_role" {
  value = aws_iam_role.orchestrator_task.arn
}

output "runner_role" {
  value = aws_iam_role.runner_task.arn
}

output "ecr_repositories" {
  value = {
    orchestrator = aws_ecr_repository.orchestrator.repository_url
    gateway      = aws_ecr_repository.gateway.repository_url
    runner       = aws_ecr_repository.runner.repository_url
  }
}
