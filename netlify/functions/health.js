/**
 * Health check endpoint
 * GET /api/health
 */
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'ok',
      message: 'Lybrarian API is running',
      timestamp: new Date().toISOString()
    }),
  };
};
