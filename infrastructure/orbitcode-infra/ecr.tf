resource "aws_ecr_repository" "orchestrator" {
  name                 = "${var.project_name}-orchestrator"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "gateway" {
  name                 = "${var.project_name}-gateway"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "runner" {
  name                 = "${var.project_name}-runner"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
