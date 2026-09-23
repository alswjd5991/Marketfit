-- 0001_init.sql이 중간에 실패했을 때 깨끗하게 되돌리기 위한 초기화 스크립트.
-- 새 프로젝트(=지울 실데이터 없음)에서만 사용할 것. 이미 저장된 실데이터가 있다면 절대 실행하지 말 것.

drop table if exists knowledge_chunks cascade;
drop table if exists knowledge_documents cascade;
drop table if exists chat_messages cascade;
drop table if exists chat_conversations cascade;
drop table if exists notifications cascade;
drop table if exists event_checklists cascade;
drop table if exists event_product_sales cascade;
drop table if exists event_participations cascade;
drop table if exists event_reviews cascade;
drop table if exists event_recruitments cascade;
drop table if exists events cascade;
drop table if exists products cascade;
drop table if exists stores cascade;
drop table if exists profiles cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

drop type if exists participation_status;
drop type if exists recruitment_status;
drop type if exists source_type;
