create table if not exists uploaded_files (
  id serial primary key,
  filename text unique not null,
  mime_type text not null,
  size_bytes int not null,
  content bytea not null,
  created_at timestamptz default now()
);

