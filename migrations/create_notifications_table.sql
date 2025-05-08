-- Create notifications table for storing user notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id TEXT,
  related_type TEXT, -- 'meal_image', 'comment', etc.
  related_id UUID,   -- ID of the related entity
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON public.notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Add RLS policies for notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update is_read status of their own notifications
CREATE POLICY "Users can mark their notifications as read"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Only allow updating is_read field
    (NEW.title = OLD.title) AND
    (NEW.message = OLD.message) AND
    (NEW.sender_id = OLD.sender_id) AND
    (NEW.user_id = OLD.user_id) AND
    (NEW.school_id = OLD.school_id) AND
    (NEW.related_type = OLD.related_type) AND
    (NEW.related_id = OLD.related_id)
  );

-- Only authenticated users with proper role can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger to update updated_at field
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at_trigger
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();

-- Comment
COMMENT ON TABLE public.notifications IS 'Stores user notifications for various app events';
