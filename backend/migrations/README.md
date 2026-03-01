# Database Migrations

- **001_create_enums.sql**: Tạo enum types (`message_role`, `message_status`, `content_type`) trong `public`. Chạy trước khi restore vì `pg_dump -n ai_portal` không dump types ở public.
- **002_schema_version.sql**: Bảng `ai_portal.schema_version` theo dõi phiên bản schema.

## Khi cập nhật schema

1. Tăng phiên bản: tạo file `00X_mo_ta.sql` (VD: `003_add_xxx.sql`)
2. Migration phải idempotent khi có thể (CREATE IF NOT EXISTS, v.v.)
3. Sau khi chạy migration, runner tự ghi version vào `schema_version`
4. DB cũ khi khởi động sẽ tự chạy các migration chưa áp dụng
