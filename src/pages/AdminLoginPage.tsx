import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.jpg';

const ADMIN_ID = '01838047391';

const AdminLoginPage: React.FC = () => {
  const [adminId, setAdminId] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent;
    let deviceName = 'Unknown Device';
    let browser = 'Unknown Browser';

    if (/iPhone|iPad|iPod/.test(userAgent)) {
      deviceName = 'iOS Device';
    } else if (/Android/.test(userAgent)) {
      deviceName = 'Android Device';
    } else if (/Windows/.test(userAgent)) {
      deviceName = 'Windows PC';
    } else if (/Mac/.test(userAgent)) {
      deviceName = 'Mac';
    } else if (/Linux/.test(userAgent)) {
      deviceName = 'Linux PC';
    }

    if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) {
      browser = 'Chrome';
    } else if (/Firefox/.test(userAgent)) {
      browser = 'Firefox';
    } else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
      browser = 'Safari';
    } else if (/Edge/.test(userAgent)) {
      browser = 'Edge';
    }

    return { deviceName, browser };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminId.trim()) {
      toast.error('Please enter Admin ID');
      return;
    }

    if (adminId.trim() !== ADMIN_ID) {
      toast.error('Invalid Admin ID');
      return;
    }

    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsLoading(true);

    try {
      const adminEmail = `admin_${adminId}@mnrgroup.com`;
      const adminPassword = adminId;

      // Try to sign in first
      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (signInError?.message.includes('Invalid login credentials')) {
        // Create new admin account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: adminEmail,
          password: adminPassword,
          options: {
            data: { 
              name: name.trim(),
              role: 'admin'
            },
            emailRedirectTo: `${window.location.origin}/admin`
          }
        });

        if (signUpError) throw signUpError;
        signInData = signUpData;

        if (signUpData.user) {
          // Add admin role
          await supabase.from('user_roles').insert({
            user_id: signUpData.user.id,
            role: 'admin' as const
          });

          // Create profile
          await supabase.from('profiles').upsert({
            user_id: signUpData.user.id,
            name: name.trim(),
            email: adminEmail
          });
        }
      } else if (signInError) {
        throw signInError;
      }

      if (signInData?.user) {
        // Update profile name (in case admin changed)
        await supabase.from('profiles').upsert({
          user_id: signInData.user.id,
          name: name.trim(),
          email: adminEmail
        });

        // Log session
        const { deviceName, browser } = getDeviceInfo();
        await supabase.from('login_sessions').insert({
          user_id: signInData.user.id,
          role: 'admin' as const,
          device_name: deviceName,
          browser
        });

        toast.success(`Welcome, ${name.trim()}!`);
        navigate('/admin');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="login-card relative animate-slide-up max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src={logo} 
              alt="MNR Group" 
              className="h-20 w-20 rounded-full object-cover border-4 border-primary/10 shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MNR Group</h1>
          <p className="text-muted-foreground mt-1">Secure admin access</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 p-3 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium text-primary">Admin Access</span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name *</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="form-input h-11"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-2">
              <Label htmlFor="adminId">Access ID *</Label>
            <Input
              id="adminId"
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter access ID"
              className="form-input h-11"
              autoComplete="off"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 font-medium"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            © 2026 MNR Group. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
