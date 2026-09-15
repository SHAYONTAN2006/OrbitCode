resource "aws_ecs_cluster" "orchestrator" {
  name = "${var.project_name}-orchestrator-cluster"
}

resource "aws_ecs_cluster" "gateway" {
  name = "${var.project_name}-gateway-cluster"
}

resource "aws_ecs_cluster" "runner" {
  name = "${var.project_name}-runner-cluster"
}

resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/ecs/${var.project_name}/orchestrator"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "gateway" {
  name              = "/ecs/${var.project_name}/gateway"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "runner" {
  name              = "/ecs/${var.project_name}/runner"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "orchestrator" {
  family                   = "${var.project_name}-orchestrator"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.orchestrator_cpu
  memory                   = var.orchestrator_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.orchestrator_task.arn

  container_definitions = jsonencode([{
    name      = "orchestrator"
    image     = var.orchestrator_image
    essential = true

    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]

    environment = [
      {
        name  = "AWS_REGION"
        value = var.aws_region
      },
      {
        name  = "S3_BUCKET"
        value = aws_s3_bucket.workspace.bucket
      },
      {
        name  = "RUNNER_TASK_DEFINITION"
        value = aws_ecs_task_definition.runner.arn
      },
      {
        name  = "RUNNER_CLUSTER"
        value = aws_ecs_cluster.runner.name
      },
      {
        name  = "RUNNER_SUBNET_1"
        value = aws_subnet.private[0].id
      },
      {
        name  = "RUNNER_SUBNET_2"
        value = aws_subnet.private[1].id
      },
      {
        name  = "RUNNER_SECURITY_GROUP"
        value = aws_security_group.runner.id
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.orchestrator.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "orchestrator"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "gateway" {
  family                   = "${var.project_name}-gateway"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.gateway_cpu
  memory                   = var.gateway_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "gateway"
    image     = var.gateway_image
    essential = true

    portMappings = [{
      containerPort = 4000
      hostPort      = 4000
      protocol      = "tcp"
    }]

    environment = [
      {
        name  = "GATEWAY_PORT"
        value = "4000"
      },
      {
        name  = "FRONTEND_ORIGIN"
        value = "*"
      },
      {
        name  = "ORCHESTRATOR_URL"
        value = "http://${aws_lb.api.dns_name}"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.gateway.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "gateway"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "runner" {
  family                   = "${var.project_name}-runner"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.runner_cpu
  memory                   = var.runner_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.runner_task.arn

  container_definitions = jsonencode([{
    name      = "Main"
    image     = var.runner_image
    essential = true

    portMappings = [{
      containerPort = 8080
      hostPort      = 8080
      protocol      = "tcp"
    }]

    environment = [
      {
        name  = "AWS_REGION"
        value = var.aws_region
      },
      {
        name  = "S3_BUCKET"
        value = aws_s3_bucket.workspace.bucket
      },
      {
        name  = "REPL_ID"
        value = "terraform-placeholder"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.runner.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "runner"
      }
    }
  }])
}

resource "aws_ecs_service" "orchestrator" {
  name            = "${var.project_name}-orchestrator"
  cluster         = aws_ecs_cluster.orchestrator.id
  task_definition = aws_ecs_task_definition.orchestrator.arn
  desired_count   = var.desired_orchestrator_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.orchestrator.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.orchestrator.arn
    container_name   = "orchestrator"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.api]
}

resource "aws_ecs_service" "gateway" {
  name            = "${var.project_name}-gateway"
  cluster         = aws_ecs_cluster.gateway.id
  task_definition = aws_ecs_task_definition.gateway.arn
  desired_count   = var.desired_gateway_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.gateway.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.gateway.arn
    container_name   = "gateway"
    container_port   = 4000
  }

  depends_on = [aws_lb_listener.execution]
}
