#[cfg(test)]
mod tests {
    use crate::models::{ServerPricingResponse, ServerPriceListItem};
    use serde_json::json;

    #[test]
    fn test_deserialization_with_mixed_prices() {
        let json_data = json!({
            "metadata": {
                "syncedAt": "2026-02-11T07:36:06.063Z",
                "isDelta": true,
                "tempFullSync": true
            },
            "data": {
                "lists": [
                    {
                        "id": "list1",
                        "code": "SCH",
                        "priority": 90,
                        "isGlobal": false,
                        "isActive": true,
                        "validFrom": null,
                        "validTo": null,
                        "updatedAt": "2026-02-11T07:16:06.083Z"
                    }
                ],
                "items": [
                    {
                        "id": "item1",
                        "priceListId": "list1",
                        "variantId": "var1",
                        "sellingUnitId": null,
                        "minQuantity": 1,
                        "price": "1200",
                        "updatedAt": "2026-02-08T12:17:14.519Z"
                    },
                    {
                        "id": "item2",
                        "priceListId": "list1",
                        "variantId": "var2",
                        "sellingUnitId": null,
                        "minQuantity": 1,
                        "price": 1500,
                        "updatedAt": "2026-02-11T07:08:22.364Z"
                    }
                ],
                "customerAllocations": {},
                "deletedItemIds": []
            }
        });

        let response: ServerPricingResponse = serde_json::from_value(json_data).expect("Failed to deserialize");
        
        assert_eq!(response.data.items[0].price, "1200");
        assert_eq!(response.data.items[1].price, "1500");
    }

    #[test]
    fn test_metadata_delta_flags() {
        let json_data = json!({
            "metadata": {
                "syncedAt": "ts",
                "isDelta": true,
                "tempFullSync": true
            },
            "data": {
                "lists": [],
                "items": [],
                "customerAllocations": null,
                "deletedItemIds": []
            }
        });

        let response: ServerPricingResponse = serde_json::from_value(json_data).unwrap();
        assert!(response.metadata.is_delta);
        assert!(response.metadata.temp_full_sync);
    }
}
