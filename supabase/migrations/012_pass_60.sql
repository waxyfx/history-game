-- Migration 012: the pass mark for every level is 60 / 100 (was 90). A run with 60 or more points passes
-- the level and unlocks the next one; max_score stays 100, the required final trial stays as it was.
update private.official_level_rules set pass_score = 60;
