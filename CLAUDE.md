# Project Rules

## Code Style

- Always use fat arrow functions (`const fn = () => {}`). Never use `function` declarations.
- Use path aliases for cross-directory imports: `@models`, `@types`, `@middleware`, `@controllers`, `@services/*`, `@config/*`, `@db/*`, `@routes/*`. Keep intra-directory relative imports (e.g., `./auth`) as-is.
