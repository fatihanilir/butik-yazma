alter table products add column if not exists sort_order int not null default 0;

create index if not exists idx_products_sort_order on products(sort_order asc, id asc);

with ranked as (
  select id, row_number() over (order by created_at desc) - 1 as rn
  from products
)
update products p
set sort_order = ranked.rn
from ranked
where p.id = ranked.id;
