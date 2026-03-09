UPDATE quick_challenges 
SET price_per_player = price_per_player / total_slots 
WHERE payment_type = 'single' 
AND total_slots > 0 
AND price_per_player > 0;