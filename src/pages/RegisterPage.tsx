import React, { useState } from 'react';
import { GraduationCap, Mail, Lock, User, School, BookOpen, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, Link } from '../contexts/RouterContext';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Alert } from '../components/common/Alert';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { navigate } = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password) {
      setError('Please complete all required fields.');
      return;
    }

    setIsLoading(true);
    const res = await register({
      fullName,
      email,
      password,
      university,
      major,
    });
    setIsLoading(false);

    if (res.success) {
      navigate('/');
    } else {
      setError(res.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-indigo-600/30">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Create Account</h1>
          <p className="text-xs text-slate-400 mt-1">
            Join StudyAI to supercharge your university academic success.
          </p>
        </div>

        {error && (
          <Alert
            type="error"
            message={error}
            onClose={() => setError(null)}
            className="mb-4"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="Full Name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Maya Lin"
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="University Email *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maya.lin@stanford.edu"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Password *"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="University"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. Stanford"
              leftIcon={<School className="w-4 h-4" />}
            />
            <Input
              label="Major"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="e.g. CS / AI"
              leftIcon={<BookOpen className="w-4 h-4" />}
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-3"
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create My Account
          </Button>
        </form>

        <div className="mt-5 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
