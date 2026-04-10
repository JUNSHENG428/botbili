-- 为 recipe_executions 表追加 output 字段
ALTER TABLE recipe_executions
  ADD COLUMN IF NOT EXISTS output JSONB DEFAULT NULL;

-- 追加索引，方便按平台查询
CREATE INDEX IF NOT EXISTS idx_recipe_executions_output_platform
  ON recipe_executions ((output->>'platform'))
  WHERE output IS NOT NULL;

COMMENT ON COLUMN recipe_executions.output IS
  'Agent 执行结果：视频平台外链、封面截图、GIF、播放量等元数据';
