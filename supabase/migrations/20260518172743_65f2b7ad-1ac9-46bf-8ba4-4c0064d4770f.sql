ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'visa';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'mastercard';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'mixed';
ALTER TYPE public.order_type ADD VALUE IF NOT EXISTS 'delivery_app';