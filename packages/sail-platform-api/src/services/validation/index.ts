/**
 * DACP Validation Module
 *
 * Provides Zod-based validation for DACP messages, including:
 * - validateDACPMessage: Validates messages and throws on error
 * - safeParseDACPMessage: Validates messages and returns result object
 * - DACP schemas: Auto-generated Zod schemas for all DACP message types
 */

export { validateDACPMessage, safeParseDACPMessage } from "./dacp-zod-validator"
export * from "./dacp-schemas"
