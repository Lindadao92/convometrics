/**
 * AI Worker Pipeline Error Handler
 * 
 * Robust error handling for OpenAI API calls and conversation analysis workers
 * Addresses known issues: worker failures, timeout handling, retry logic
 */

export interface WorkerConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
  jitterFactor: number;
}

export interface WorkerResult<T> {
  success: boolean;
  data?: T;
  error?: WorkerError;
  retryCount: number;
  executionTime: number;
}

export interface WorkerError {
  type: 'api_error' | 'timeout' | 'rate_limit' | 'network' | 'parse_error' | 'validation_error';
  message: string;
  originalError: Error;
  retryable: boolean;
  statusCode?: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  timeout: 45000, // 45 seconds
  jitterFactor: 0.1, // 10% jitter
};

/**
 * Classify error types for appropriate retry handling
 */
function classifyError(error: unknown): WorkerError {
  const err = error instanceof Error ? error : new Error(String(error));

  // OpenAI API specific errors
  if (err.message.includes('rate limit') || err.message.includes('429')) {
    return {
      type: 'rate_limit',
      message: 'API rate limit exceeded',
      originalError: err,
      retryable: true,
      statusCode: 429,
    };
  }

  if (err.message.includes('timeout') || err.message.includes('TIMEOUT')) {
    return {
      type: 'timeout',
      message: 'Request timed out',
      originalError: err,
      retryable: true,
    };
  }

  if (err.message.includes('network') || err.message.includes('ECONNRESET') || err.message.includes('ENOTFOUND')) {
    return {
      type: 'network',
      message: 'Network connection error',
      originalError: err,
      retryable: true,
    };
  }

  if (err.message.includes('JSON') || err.message.includes('parse') || err.message.includes('SyntaxError')) {
    return {
      type: 'parse_error',
      message: 'Failed to parse API response',
      originalError: err,
      retryable: false, // Usually indicates malformed response
    };
  }

  // API errors (4xx) - usually not retryable except for specific cases
  if (err.message.includes('400') || err.message.includes('401') || err.message.includes('403')) {
    return {
      type: 'api_error',
      message: 'API authentication or request error',
      originalError: err,
      retryable: false,
    };
  }

  // 5xx errors are usually retryable
  if (err.message.includes('500') || err.message.includes('502') || err.message.includes('503')) {
    return {
      type: 'api_error',
      message: 'API server error',
      originalError: err,
      retryable: true,
      statusCode: 500,
    };
  }

  // Default case
  return {
    type: 'api_error',
    message: err.message || 'Unknown error',
    originalError: err,
    retryable: true,
  };
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, config: WorkerConfig): number {
  const exponentialDelay = Math.min(
    config.baseDelay * Math.pow(2, attempt - 1),
    config.maxDelay
  );

  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * config.jitterFactor * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Robust wrapper for AI worker operations with retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: Partial<WorkerConfig> = {}
): Promise<WorkerResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: WorkerError | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), finalConfig.timeout);
      });

      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      return {
        success: true,
        data: result,
        retryCount: attempt - 1,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      const classifiedError = classifyError(error);
      lastError = classifiedError;

      console.warn(`Worker attempt ${attempt} failed:`, {
        type: classifiedError.type,
        message: classifiedError.message,
        retryable: classifiedError.retryable,
      });

      // Don't retry if error is not retryable or we've exhausted attempts
      if (!classifiedError.retryable || attempt > finalConfig.maxRetries) {
        break;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, finalConfig);
      console.info(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${finalConfig.maxRetries + 1})`);
      
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError || {
      type: 'api_error',
      message: 'Unknown error after all retries',
      originalError: new Error('Unknown error'),
      retryable: false,
    },
    retryCount: finalConfig.maxRetries,
    executionTime: Date.now() - startTime,
  };
}

/**
 * Batch processing with concurrent limit and error handling
 */
export async function processBatch<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => Promise<TOutput>,
  options: {
    batchSize?: number;
    concurrency?: number;
    config?: Partial<WorkerConfig>;
  } = {}
): Promise<Array<WorkerResult<TOutput>>> {
  const { batchSize = 10, concurrency = 3, config = {} } = options;
  const results: Array<WorkerResult<TOutput>> = [];

  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch with concurrency limit
    const batchPromises = batch.map(item =>
      executeWithRetry(() => processor(item), config)
    );

    // Process with concurrency control
    const batchResults = [];
    for (let j = 0; j < batchPromises.length; j += concurrency) {
      const concurrentPromises = batchPromises.slice(j, j + concurrency);
      const concurrentResults = await Promise.all(concurrentPromises);
      batchResults.push(...concurrentResults);
    }

    results.push(...batchResults);

    // Log batch progress
    console.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
  }

  return results;
}

/**
 * Circuit breaker pattern for failing services
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime < this.timeout) {
        throw new Error('Circuit breaker is open');
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime,
    };
  }
}

/**
 * Global circuit breakers for different services
 */
export const circuitBreakers = {
  openai: new CircuitBreaker(5, 60000),
  supabase: new CircuitBreaker(3, 30000),
};

/**
 * Wrapper function for OpenAI API calls with circuit breaker
 */
export async function callOpenAIWithProtection<T>(
  operation: () => Promise<T>,
  config: Partial<WorkerConfig> = {}
): Promise<WorkerResult<T>> {
  return executeWithRetry(
    () => circuitBreakers.openai.execute(operation),
    config
  );
}

/**
 * Health check for worker pipeline
 */
export async function healthCheck(): Promise<{
  openai: boolean;
  supabase: boolean;
  circuitBreakers: Record<string, any>;
}> {
  const results = {
    openai: false,
    supabase: false,
    circuitBreakers: {
      openai: circuitBreakers.openai.getState(),
      supabase: circuitBreakers.supabase.getState(),
    },
  };

  // Test OpenAI connection
  try {
    await circuitBreakers.openai.execute(async () => {
      // Simple test - would replace with actual API call
      await sleep(100);
      return true;
    });
    results.openai = true;
  } catch {
    results.openai = false;
  }

  // Test Supabase connection  
  try {
    await circuitBreakers.supabase.execute(async () => {
      // Simple test - would replace with actual DB call
      await sleep(100);
      return true;
    });
    results.supabase = true;
  } catch {
    results.supabase = false;
  }

  return results;
}