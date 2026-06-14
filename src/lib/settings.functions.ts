import { createApiAction } from "@/lib/api-client";

export const getRestaurantSettings = createApiAction("getRestaurantSettings", "POST");
export const updateRestaurantSettings = createApiAction("updateRestaurantSettings", "POST");
