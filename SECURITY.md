# Security Policy

## Overview

The Mahder API project is committed to maintaining the highest standards of security to protect our users' data, financial transactions, and platform integrity. This document outlines our security policies, vulnerability reporting procedures, and responsible disclosure guidelines.

## Supported Versions

We actively maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Scope

Our security policy covers the following components and areas:

### In Scope
- **API Endpoints**: All REST API endpoints and authentication mechanisms
- **Authentication & Authorization**: JWT tokens, role-based access control, user sessions
- **Data Protection**: User data, project data, financial information, audio files
- **Database Security**: PostgreSQL queries, data encryption, access controls
- **File Storage**: MinIO/S3 file uploads, access permissions, data integrity
- **Communication Channels**: SMS, email, push notifications, data transmission
- **Payment Processing**: Santim Pay integration, wallet management, transaction security
- **Infrastructure**: Docker containers, environment configurations, service dependencies
- **Third-party Integrations**: Firebase, Redis, external SMS/email providers

### Out of Scope
- **Physical Security**: Data center security, hardware access
- **Social Engineering**: Attacks targeting individual users outside the application
- **Denial of Service**: Large-scale DDoS attacks (unless exploiting application vulnerabilities)
- **Third-party Services**: Security issues in external services we integrate with (unless our integration creates the vulnerability)

## Vulnerability Categories

We prioritize security issues based on the following categories:

### Critical Severity
- Remote code execution
- SQL injection leading to data breach
- Authentication bypass affecting multiple users
- Unauthorized access to financial data or transactions
- Mass data exposure or breach

### High Severity
- Cross-site scripting (XSS) with significant impact
- Privilege escalation
- Unauthorized access to user data
- Payment system vulnerabilities
- File upload vulnerabilities leading to system compromise

### Medium Severity
- Information disclosure
- Cross-site request forgery (CSRF)
- Business logic flaws
- Insecure direct object references
- Session management issues

### Low Severity
- Security misconfigurations with limited impact
- Information leakage with minimal risk
- Minor authentication issues

## Reporting Security Vulnerabilities

We take security vulnerabilities seriously and appreciate responsible disclosure from the security community.

### How to Report

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please report security vulnerabilities through one of these secure channels:

1. **Email**: Send details to `security@mahder-api.com`
2. **Encrypted Email**: Use our PGP key (available on request) for sensitive reports
3. **Private Communication**: Contact the development team directly through secure channels

### What to Include

When reporting a vulnerability, please provide:

- **Description**: Clear description of the vulnerability
- **Impact**: Potential impact and affected components
- **Reproduction Steps**: Detailed steps to reproduce the issue
- **Proof of Concept**: Code, screenshots, or other evidence (if applicable)
- **Suggested Fix**: Recommendations for remediation (if available)
- **Environment**: Version information, configuration details
- **Contact Information**: How we can reach you for follow-up questions

### Example Report Template

```
Subject: [SECURITY] Vulnerability Report - [Brief Description]

Vulnerability Type: [e.g., SQL Injection, XSS, Authentication Bypass]
Severity: [Critical/High/Medium/Low]
Affected Component: [e.g., User Authentication, Payment System]
Affected Version: [Version number or commit hash]

Description:
[Detailed description of the vulnerability]

Impact:
[What an attacker could achieve by exploiting this vulnerability]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Proof of Concept:
[Code snippets, screenshots, or other evidence]

Suggested Remediation:
[Your recommendations for fixing the issue]

Reporter Information:
Name: [Your name]
Email: [Your email]
Organization: [If applicable]
```

## Responsible Disclosure Policy

### Our Commitment

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Regular Updates**: We will provide status updates every 7 days until resolution
- **Resolution Timeline**: We aim to resolve critical issues within 30 days, high severity within 60 days
- **Credit**: We will publicly credit researchers (unless they prefer to remain anonymous)

### Researcher Guidelines

To qualify for our responsible disclosure program, please:

**DO:**
- Report vulnerabilities as soon as possible after discovery
- Provide sufficient detail for us to reproduce and validate the issue
- Use only test accounts and data for your research
- Respect user privacy and data confidentiality
- Follow applicable laws and regulations
- Allow reasonable time for us to address the issue before public disclosure

**DO NOT:**
- Access, modify, or delete user data without explicit permission
- Perform actions that could harm the availability or integrity of our services
- Social engineer our employees, contractors, or users
- Violate the privacy of our users
- Disclose the vulnerability publicly before we have had time to address it
- Demand compensation or threaten public disclosure

### Safe Harbor

We will not pursue legal action against researchers who:
- Follow our responsible disclosure policy
- Act in good faith
- Do not violate any laws
- Do not access or modify user data beyond what is necessary to demonstrate the vulnerability
- Do not impact the availability or integrity of our services

## Security Measures

### Current Security Controls

- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control (RBAC) with fine-grained permissions
- **Input Validation**: Comprehensive request validation using Zod schemas
- **SQL Injection Protection**: TypeORM query builder with parameterized queries
- **Password Security**: Bcrypt hashing with appropriate salt rounds
- **Rate Limiting**: API rate limiting to prevent abuse and brute force attacks
- **CORS Configuration**: Properly configured cross-origin resource sharing
- **HTTPS Enforcement**: TLS encryption for all data in transit
- **Data Encryption**: Sensitive data encryption at rest
- **Session Management**: Secure session handling with proper timeout
- **File Upload Security**: Validated file types, size limits, and secure storage
- **Audit Logging**: Comprehensive logging of security-relevant events

### Ongoing Security Practices

- **Regular Security Reviews**: Periodic code reviews focusing on security
- **Dependency Scanning**: Automated scanning for vulnerable dependencies
- **Security Testing**: Integration of security testing in CI/CD pipeline
- **Environment Hardening**: Secure configuration of production environments
- **Access Controls**: Principle of least privilege for system access
- **Backup Security**: Encrypted backups with secure storage
- **Incident Response**: Documented procedures for security incidents

## Security Updates

### Update Process

1. **Vulnerability Assessment**: Evaluate severity and impact
2. **Fix Development**: Develop and test security patches
3. **Testing**: Comprehensive testing in staging environment
4. **Deployment**: Coordinated deployment to production
5. **Verification**: Post-deployment verification of fixes
6. **Communication**: Notify affected users and stakeholders

### Notification Channels

- **Security Advisories**: Published on our GitHub repository
- **Email Notifications**: Direct communication to registered users
- **API Versioning**: Clear versioning for security-related updates
- **Documentation Updates**: Updated security documentation

## Compliance and Standards

### Security Standards

We align our security practices with industry standards:

- **OWASP Top 10**: Regular assessment against OWASP security risks
- **NIST Cybersecurity Framework**: Implementation of NIST guidelines
- **ISO 27001**: Information security management best practices
- **PCI DSS**: Payment card industry security standards (where applicable)

### Data Protection

- **Data Minimization**: Collect only necessary data
- **Purpose Limitation**: Use data only for stated purposes
- **Retention Policies**: Clear data retention and deletion policies
- **User Rights**: Support for user data access, correction, and deletion requests
- **Cross-border Transfers**: Secure handling of international data transfers

## Contact Information

### Security Team

- **Email**: security@mahder-api.com
- **Response Time**: 48 hours for acknowledgment
- **Business Hours**: Monday-Friday, 9 AM - 5 PM UTC

### Emergency Contact

For critical security issues requiring immediate attention:
- **Emergency Email**: security-emergency@mahder-api.com
- **Response Time**: 4 hours during business hours, 12 hours outside business hours

## Acknowledgments

We would like to thank the following security researchers who have helped improve our security:

*[This section will be updated as we receive and address security reports]*

## Legal

This security policy is subject to our Terms of Service and Privacy Policy. By participating in our responsible disclosure program, you agree to these terms and conditions.

---

**Last Updated**: January 12, 2026  
**Version**: 1.0  
**Next Review**: April 12, 2026