import { z } from "zod"
import { DACPValidationError } from "@finos/sail-desktop-agent"

/**
 * Validates a DACP message against a Zod schema.
 * Throws DACPValidationError if validation fails.
 *
 * @param message - The message to validate
 * @param schema - The Zod schema to validate against
 * @returns The validated and typed message
 * @throws DACPValidationError if validation fails
 */
export function validateDACPMessage<T>(message: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(message)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")
      throw new DACPValidationError(`Invalid DACP message structure: ${errorDetails}`, error)
    }
    throw new DACPValidationError(`Unknown validation error: ${error as string}`)
  }
}

/**
 * Safely validates a DACP message against a Zod schema.
 * Returns a result object instead of throwing.
 *
 * @param message - The message to validate
 * @param schema - The Zod schema to validate against
 * @returns Success result with data or failure result with error
 */
export function safeParseDACPMessage<T>(
  message: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: DACPValidationError } {
  try {
    const data = validateDACPMessage(message, schema)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof DACPValidationError
          ? error
          : new DACPValidationError(`${error as string}`),
    }
  }
}
