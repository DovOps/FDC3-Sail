/**
 * Universal Middleware Pipeline
 *
 * Implements the Chain of Responsibility pattern for processing messages.
 * This module is environment-agnostic and can be used in both Node.js and Browser.
 */

/**
 * Context passed through the middleware chain.
 * Can be extended to include additional metadata.
 */
export interface MiddlewareContext<T = unknown> {
  /**
   * The message or payload being processed
   */
  message: T

  /**
   * Optional metadata or context about the message
   */
  meta?: Record<string, unknown>
}

/**
 * Function to call the next middleware in the chain.
 */
export type NextFunction = () => Promise<void>

/**
 * Middleware function signature.
 */
export type Middleware<T = unknown> = (
  context: MiddlewareContext<T>,
  next: NextFunction
) => Promise<void> | void

/**
 * Pipeline for managing and executing middleware.
 */
export class MiddlewarePipeline<T = unknown> {
  private middlewares: Middleware<T>[] = []

  /**
   * Add a middleware to the pipeline.
   * @param middleware The middleware function to add
   */
  use(middleware: Middleware<T>): this {
    this.middlewares.push(middleware)
    return this
  }

  /**
   * Execute the middleware chain.
   * @param context The context to pass through the chain
   * @param target The final function to execute at the end of the chain
   */
  async execute(
    context: MiddlewareContext<T>,
    target: (context: MiddlewareContext<T>) => Promise<void>
  ): Promise<void> {
    let index = -1

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error("next() called multiple times")
      }
      index = i

      const middleware = this.middlewares[i]

      if (i === this.middlewares.length) {
        // End of chain, execute target
        await target(context)
        return
      }

      // Execute middleware
      await middleware(context, async () => {
        await dispatch(i + 1)
      })
    }

    await dispatch(0)
  }
}
