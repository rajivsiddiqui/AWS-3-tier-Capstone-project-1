variable "aws_region"    { default = "us-east-2" }
variable "project"       { default = "capstone" }
variable "ami_id"        { default = "ami-0772d6acfbccb1275" } # Amazon Linux 2023 us-east-1
variable "key_pair_name" { description = "Name of existing EC2 Key Pair" }
variable "your_ip"       { description = "Your IP for SSH/Jenkins access e.g. 1.2.3.4/32" }
variable "db_password"   {
  description = "RDS MySQL root password"
  sensitive   = true
}
