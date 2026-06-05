alter table products add column if not exists product_code text;
alter table products alter column price drop not null;
create index if not exists idx_products_product_code on products(product_code);
