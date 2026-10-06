import { useState } from 'react';
import { api } from '../api.js';
import { useFlash } from '../flash.jsx';

export default function ResetPasswordButton({ userId }) {
  const flash = useFlash();
  const [loading, setLoading] = useState(false);

  const reset = async () => {
    if (!window.confirm('Reset this user password?')) return;

    setLoading(true);

    try {
      const result = await api.post(`/admin/users/${userId}/reset-password`);
      flash(result.message || 'Password reset successfully.');
    } catch (err) {
      flash(err.message || 'Failed to reset password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-secondary btn-xs"
      onClick={reset}
      disabled={loading}
    >
      {loading ? 'Resetting...' : 'Reset password'}
    </button>
  );
}
