
-- Create notification function
CREATE OR REPLACE FUNCTION notify_new_notification()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'new_notification', 
        row_to_json(NEW)::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER notify_after_insert
AFTER INSERT ON event
FOR EACH ROW
EXECUTE FUNCTION notify_new_notification();