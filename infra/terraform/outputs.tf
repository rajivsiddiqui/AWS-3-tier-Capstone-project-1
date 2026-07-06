output "jenkins_ip"       { value = aws_instance.jenkins.public_ip }
output "dev_ec2_ip"       { value = aws_instance.dev.public_ip }
output "prod_ec2_ip"      { value = aws_instance.prod.public_ip }
output "rds_endpoint"     { value = aws_db_instance.mysql.endpoint }
output "ecr_backend_url"  { value = aws_ecr_repository.backend.repository_url }
output "ecr_frontend_url" { value = aws_ecr_repository.frontend.repository_url }
output "s3_bucket"        { value = aws_s3_bucket.assets.bucket }
