use sqlx::{SqlitePool, Row};
use crate::stores::product_store;
use crate::models::PosProduct;

#[tokio::test]
async fn test_sqlite_schema_initialization() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

    // Manually run the table creation logic from init_state (since it normally takes AppHandle)
    let create_products_table = r#"
        CREATE TABLE IF NOT EXISTS products (
            product_id TEXT,
            location_id TEXT,
            category TEXT,
            product_name TEXT,
            search_text TEXT,
            payload TEXT,
            PRIMARY KEY (product_id, location_id)
        )
    "#;

    sqlx::query(create_products_table).execute(&pool).await.unwrap();

    // Verify table exists
    let row = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
        .fetch_one(&pool)
        .await
        .unwrap();

    let table_name: String = row.get("name");
    assert_eq!(table_name, "products");
}

#[tokio::test]
async fn test_product_upsert_integrity() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

    sqlx::query(r#"
        CREATE TABLE products (
            product_id TEXT,
            location_id TEXT,
            category TEXT,
            product_name TEXT,
            search_text TEXT,
            payload TEXT,
            PRIMARY KEY (product_id, location_id)
        )
    "#).execute(&pool).await.unwrap();

    let product_id = "p123";
    let location_id = "loc1";
    let payload = r#"{"productId":"p123","name":"Test Product","category":"Test","variants":[]}"#;

    // Test Insert
    sqlx::query("INSERT INTO products (product_id, location_id, product_name, payload) VALUES (?1, ?2, ?3, ?4)")
        .bind(product_id)
        .bind(location_id)
        .bind("Test Product")
        .bind(payload)
        .execute(&pool)
        .await
        .unwrap();

    // Test Upsert (Manual check of logic used in product_store)
    let new_payload = r#"{"productId":"p123","name":"Updated Product","category":"Test","variants":[]}"#;
    sqlx::query(r#"
        INSERT INTO products (product_id, location_id, product_name, payload)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(product_id, location_id) DO UPDATE SET
            product_name = excluded.product_name,
            payload = excluded.payload
    "#)
    .bind(product_id)
    .bind(location_id)
    .bind("Updated Product")
    .bind(new_payload)
    .execute(&pool)
    .await
    .unwrap();

    let row = sqlx::query("SELECT product_name, payload FROM products WHERE product_id = ?1")
        .bind(product_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    let name: String = row.get("product_name");
    let saved_payload: String = row.get("payload");

    assert_eq!(name, "Updated Product");
    assert_eq!(saved_payload, new_payload);
}
