const { StatusCodeError, asyncHandler } = require('../endpointHelper.js');

describe('EndpointHelper', () => {
  describe('StatusCodeError', () => {
    test('should create error with message and status code', () => {
      const error = new StatusCodeError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error instanceof Error).toBe(true);
    });

    test('should inherit from Error', () => {
      const error = new StatusCodeError('Test error', 500);

      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('Error');
    });
  });

  describe('asyncHandler', () => {
    test('should handle successful async function', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      const handler = asyncHandler(mockFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should catch and pass errors to next', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      const handler = asyncHandler(mockFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should handle StatusCodeError', async () => {
      const error = new StatusCodeError('Custom error', 400);
      const mockFn = jest.fn().mockRejectedValue(error);
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      const handler = asyncHandler(mockFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should return a function', () => {
      const mockFn = jest.fn();
      const handler = asyncHandler(mockFn);

      expect(typeof handler).toBe('function');
    });
  });
});