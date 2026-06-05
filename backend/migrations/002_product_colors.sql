create table if not exists product_colors (
  id serial primary key,
  product_id int not null references products(id) on delete cascade,
  color_name text not null,
  color_hex text null,
  sort_order int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists product_colors_unique_name_per_product
  on product_colors(product_id, lower(color_name));

alter table product_images add column if not exists color_id int null;
alter table product_sizes add column if not exists color_id int null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_images_color_fk') then
    alter table product_images
      add constraint product_images_color_fk
      foreign key (color_id) references product_colors(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_sizes_color_fk') then
    alter table product_sizes
      add constraint product_sizes_color_fk
      foreign key (color_id) references product_colors(id) on delete cascade;
  end if;
end $$;

insert into product_colors(product_id, color_name, color_hex, sort_order, is_default)
select p.id, 'Standart', null, 0, true
from products p
where not exists (
  select 1 from product_colors pc where pc.product_id = p.id
);

update product_images pi
set color_id = pc.id
from product_colors pc
where pi.product_id = pc.product_id
  and pc.is_default = true
  and pi.color_id is null;

update product_sizes ps
set color_id = pc.id
from product_colors pc
where ps.product_id = pc.product_id
  and pc.is_default = true
  and ps.color_id is null;
