// src/config/api.ts

export const API_ROUTES = {
  FULFILLMENT: {
    WAYBILL: (id: string) => `api/v1/pos/waybill/${id}`,
    // Example of future route
    // FULFILLMENT_WAYBILL: (fulfillmentId: string) => `api/v1/fulfillment/${fulfillmentId}/waybill`,
  },
  // Add other frontend routes here as they are discovered
};
