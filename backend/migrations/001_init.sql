create table if not exists admin_users (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text unique not null,
  description text default '',
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists products (
  id serial primary key,
  name text not null,
  description text default '',
  price numeric(10,2) not null,
  category_id int references categories(id) on delete restrict,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists product_images (
  id serial primary key,
  product_id int references products(id) on delete cascade,
  url text not null,
  alt_text text default '',
  sort_order int default 0,
  is_primary boolean default false
);

create table if not exists product_sizes (
  id serial primary key,
  product_id int references products(id) on delete cascade,
  size_label text not null,
  stock_quantity int not null default 0
);

create table if not exists stock_history (
  id serial primary key,
  product_size_id int references product_sizes(id) on delete cascade,
  old_quantity int not null,
  new_quantity int not null,
  changed_at timestamptz default now()
);
