resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "runner_task" {
  name = "${var.project_name}-runner-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "runner_s3" {
  name = "${var.project_name}-runner-s3"
  role = aws_iam_role.runner_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:ListBucket"
      ]
      Resource = aws_s3_bucket.workspace.arn
    }, {
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject"
      ]
      Resource = "${aws_s3_bucket.workspace.arn}/*"
    }]
  })
}

resource "aws_iam_role" "orchestrator_task" {
  name = "${var.project_name}-orchestrator-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "orchestrator" {
  name = "${var.project_name}-orchestrator-policy"
  role = aws_iam_role.orchestrator_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "S3ListBucket"
      Effect = "Allow"
      Action = ["s3:ListBucket"]
      Resource = aws_s3_bucket.workspace.arn
    }, {
      Sid    = "S3WorkspaceObjects"
      Effect = "Allow"
      Action = ["s3:GetObject", "s3:PutObject"]
      Resource = "${aws_s3_bucket.workspace.arn}/*"
    }, {
      Sid    = "RunRunnerTasks"
      Effect = "Allow"
      Action = ["ecs:RunTask"]
      Resource = aws_ecs_task_definition.runner.arn
    }, {
      Sid    = "DescribeRunnerTasks"
      Effect = "Allow"
      Action = ["ecs:DescribeTasks"]
      Resource = "*"
    }, {
      Sid    = "DescribeRunnerNetworkInterface"
      Effect = "Allow"
      Action = ["ec2:DescribeNetworkInterfaces"]
      Resource = "*"
    }, {
      Sid    = "PassRunnerRoles"
      Effect = "Allow"
      Action = ["iam:PassRole"]
      Resource = [
        aws_iam_role.runner_task.arn,
        aws_iam_role.ecs_execution.arn
      ]
    }]
  })
}
