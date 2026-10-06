# Contributing to Mahder API

Thank you for your interest in contributing to the Mahder API project! We welcome contributions from developers of all skill levels and backgrounds. This guide will help you get started and ensure your contributions align with our project standards.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Contribution Types](#contribution-types)
- [Development Guidelines](#development-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Security Contributions](#security-contributions)
- [Community and Support](#community-and-support)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@mahder-api.com](mailto:conduct@mahder-api.com).

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** (v20 or higher)
- **PostgreSQL** (v12 or higher)
- **Redis** (v7 or higher)
- **Git** for version control
- **Docker** (optional, for containerized development)
- Basic knowledge of **TypeScript**, **NestJS**, and **REST APIs**

### First-Time Contributors

If you're new to open source or this project:

1. **Read the Documentation**: Start with our [README.md](README.md) to understand the project
2. **Explore the Codebase**: Familiarize yourself with the project structure
3. **Look for Good First Issues**: Check issues labeled `good first issue` or `help wanted`
4. **Join the Community**: Introduce yourself and ask questions
5. **Start Small**: Begin with documentation improvements or minor bug fixes

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/hyperdata-backend.git
cd hyperdata-backend

# Add the original repository as upstream
git remote add upstream https://github.com/ORIGINAL_OWNER/hyperdata-backend.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Configure your local environment variables
# See README.md for detailed configuration instructions
```

### 4. Database Setup

```bash
# Start PostgreSQL and Redis (if not already running)
# Then run migrations and seed data
npm run migration:run
npm run seed
```

### 5. Verify Setup

```bash
# Run tests to ensure everything is working
npm run test

# Start the development server
npm run start:dev

# Verify the API is running at http://localhost:3000/api
```

## How to Contribute

### 1. Choose Your Contribution

- **Bug Fixes**: Look for issues labeled `bug`
- **New Features**: Check issues labeled `enhancement` or `feature request`
- **Documentation**: Issues labeled `documentation`
- **Performance**: Issues labeled `performance`
- **Security**: Follow our [Security Policy](SECURITY.md) for security-related contributions

### 2. Create a Branch

```bash
# Create a new branch for your contribution
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
# or
git checkout -b docs/documentation-update
```

### 3. Make Your Changes

Follow our [Development Guidelines](#development-guidelines) while making changes.

### 4. Test Your Changes

```bash
# Run all tests
npm run test

# Run end-to-end tests
npm run test:e2e

# Check code coverage
npm run test:cov

# Lint your code
npm run lint

# Format your code
npm run format
```

### 5. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: add user authentication middleware"
```

### 6. Push and Create Pull Request

```bash
# Push your branch to your fork
git push origin feature/your-feature-name

# Create a pull request on GitHub
```

## Contribution Types

### Bug Fixes

- **Identify the Issue**: Clearly understand the problem
- **Reproduce the Bug**: Create steps to reproduce the issue
- **Write Tests**: Add tests that fail before your fix and pass after
- **Fix the Issue**: Implement the minimal fix required
- **Update Documentation**: If the fix affects documented behavior

### New Features

- **Discuss First**: Open an issue to discuss the feature before implementing
- **Follow Design Patterns**: Maintain consistency with existing code
- **Add Tests**: Comprehensive test coverage for new functionality
- **Update Documentation**: Include API documentation and usage examples
- **Consider Backwards Compatibility**: Avoid breaking existing functionality

### Documentation Improvements

- **API Documentation**: Update Swagger/OpenAPI specifications
- **Code Comments**: Add or improve inline documentation
- **README Updates**: Keep installation and usage instructions current
- **Examples**: Provide clear, working examples
- **Tutorials**: Create step-by-step guides for common tasks

### Performance Optimizations

- **Benchmark First**: Measure current performance
- **Profile the Code**: Identify actual bottlenecks
- **Implement Changes**: Make targeted optimizations
- **Measure Impact**: Verify performance improvements
- **Document Changes**: Explain the optimization and its impact

## Development Guidelines

### Code Style

We use ESLint and Prettier for consistent code formatting:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### TypeScript Standards

- **Strict Mode**: Use TypeScript strict mode
- **Type Safety**: Avoid `any` types when possible
- **Interfaces**: Define clear interfaces for data structures
- **Generics**: Use generics for reusable components
- **Null Safety**: Handle null and undefined values explicitly

### NestJS Best Practices

- **Modules**: Organize code into logical modules
- **Dependency Injection**: Use NestJS DI container properly
- **Decorators**: Use appropriate decorators for controllers, services, etc.
- **Guards**: Implement authentication and authorization guards
- **Interceptors**: Use interceptors for cross-cutting concerns
- **Pipes**: Implement validation and transformation pipes

### Database Guidelines

- **Migrations**: Always create migrations for schema changes
- **Entities**: Use TypeORM entities with proper relationships
- **Queries**: Use query builders for complex queries
- **Transactions**: Use transactions for data consistency
- **Indexing**: Add appropriate database indexes

### API Design

- **RESTful**: Follow REST principles
- **Versioning**: Use API versioning for breaking changes
- **Status Codes**: Use appropriate HTTP status codes
- **Error Handling**: Implement consistent error responses
- **Validation**: Validate all input data
- **Documentation**: Keep Swagger documentation updated

### Security Considerations

- **Input Validation**: Validate and sanitize all inputs
- **Authentication**: Implement proper authentication mechanisms
- **Authorization**: Use role-based access control
- **Data Protection**: Encrypt sensitive data
- **SQL Injection**: Use parameterized queries
- **XSS Prevention**: Sanitize output data

## Testing Requirements

### Unit Tests

- **Coverage**: Aim for >80% code coverage
- **Isolation**: Test units in isolation with mocks
- **Naming**: Use descriptive test names
- **Structure**: Follow Arrange-Act-Assert pattern

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = { email: 'test@example.com', name: 'Test User' };
      
      // Act
      const result = await userService.createUser(userData);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
    });
  });
});
```

### Integration Tests

- **Database**: Test database interactions
- **APIs**: Test complete API endpoints
- **Services**: Test service integrations
- **Authentication**: Test auth flows

### End-to-End Tests

- **User Flows**: Test complete user journeys
- **API Contracts**: Verify API behavior
- **Error Scenarios**: Test error handling
- **Performance**: Basic performance testing

## Documentation Standards

### Code Documentation

```typescript
/**
 * Creates a new user in the system
 * @param userData - The user data to create
 * @returns Promise<User> - The created user object
 * @throws {ValidationError} When user data is invalid
 * @throws {ConflictError} When user already exists
 */
async createUser(userData: CreateUserDto): Promise<User> {
  // Implementation
}
```

### API Documentation

- **Swagger Decorators**: Use NestJS Swagger decorators
- **Examples**: Provide request/response examples
- **Error Codes**: Document possible error responses
- **Authentication**: Document auth requirements

### README Updates

- **Installation**: Keep setup instructions current
- **Configuration**: Document all environment variables
- **Usage**: Provide clear usage examples
- **Troubleshooting**: Include common issues and solutions

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated as needed
- [ ] No merge conflicts with main branch
- [ ] Commit messages follow conventional format

### PR Template

When creating a pull request, include:

```markdown
## Description
Brief description of changes made

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests pass locally

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: Maintainers review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Get approval from required reviewers
5. **Merge**: Maintainers merge your contribution

### Review Criteria

Reviewers will check for:

- **Functionality**: Does the code work as intended?
- **Code Quality**: Is the code clean and maintainable?
- **Testing**: Are there adequate tests?
- **Documentation**: Is documentation updated?
- **Security**: Are there any security concerns?
- **Performance**: Does it impact performance?
- **Compatibility**: Does it break existing functionality?

## Issue Guidelines

### Reporting Bugs

Use the bug report template:

```markdown
**Bug Description**
A clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Environment**
- OS: [e.g. Windows 10]
- Node.js version: [e.g. 20.0.0]
- Project version: [e.g. 1.0.0]

**Additional Context**
Any other context about the problem
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
A clear description of the feature you'd like to see

**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How would you like this feature to work?

**Alternatives Considered**
Any alternative solutions you've considered

**Additional Context**
Any other context or screenshots
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested
- `wontfix` - This will not be worked on

## Security Contributions

For security-related contributions:

1. **DO NOT** create public issues for security vulnerabilities
2. **Follow** our [Security Policy](SECURITY.md)
3. **Report** vulnerabilities privately to security@mahder-api.com
4. **Wait** for acknowledgment before proceeding
5. **Coordinate** with maintainers on disclosure timeline

## Community and Support

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Email**: For private inquiries at [support@mahder-api.com](mailto:support@mahder-api.com)

### Communication Guidelines

- **Be Respectful**: Follow our Code of Conduct
- **Be Clear**: Provide clear, detailed information
- **Be Patient**: Maintainers are volunteers
- **Be Helpful**: Help others when you can

### Recognition

We appreciate all contributions and will:

- **Credit Contributors**: In release notes and documentation
- **Highlight Contributions**: In project communications
- **Provide Feedback**: On your contributions
- **Support Growth**: Help you become a better contributor

## Development Resources

### Useful Links

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeORM Documentation](https://typeorm.io/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Project Structure

```
src/
├── auth/           # Authentication module
├── base-data/      # Master data management
├── cache/          # Redis caching
├── communication/  # SMS, email, notifications
├── data-set/       # Data collection module
├── finance/        # Payment and wallet management
├── project/        # Project management
├── statistics/     # Analytics and reporting
├── task-distribution/ # Task assignment
├── user/           # User management
└── common/         # Shared utilities
```

## Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search existing issues and discussions
3. Create a new discussion or issue
4. Contact maintainers directly

Thank you for contributing to Mahder API! 🚀

---

**Last Updated**: January 12, 2026  
**Version**: 1.0