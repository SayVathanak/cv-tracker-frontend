import { useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa'
import { BsXLg } from "react-icons/bs";

const LoginModal = ({ onClose, onSuccess, API_URL }) => {
  const [isRegistering, setIsRegistering] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(""); setSuccessMsg("")
    try {
      if (isRegistering) {
        await axios.post(`${API_URL}/register`, { username, password })
        setSuccessMsg("Account created! Please log in.")
        setIsRegistering(false); setPassword("")
      } else {
        const formData = new FormData()
        formData.append('username', username)
        formData.append('password', password)
        const res = await axios.post(`${API_URL}/token`, formData)
        onSuccess(res.data.access_token, username)
      }
    } catch (err) {
      if (isRegistering) setError(err.response?.data?.detail || "Registration failed. Please try signing up with Google.")
      else setError("Invalid username or password")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true); setError("")
    try {
      const res = await axios.post(`${API_URL}/auth/google`, {
        token: credentialResponse.credential
      });
      onSuccess(res.data.access_token, res.data.username);
    } catch (err) {
      setError("Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-zinc-100/60 backdrop-blur-md select-none">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white w-full max-w-[420px] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden relative border border-white">
          <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-40 h-40 bg-green-500/10 blur-[60px] rounded-full pointer-events-none"></div>
          <button onClick={onClose} className="absolute top-5 right-5 text-zinc-400 hover:text-black transition z-10"><BsXLg size={14} /></button>
          <div className="p-8 relative z-0">
            <div className="text-center mb-8">
              <img src="/logo.svg" alt="Logo" className="w-12 h-12 mx-auto mb-4 object-contain drop-shadow-md" />
              <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{isRegistering ? "Create Account" : "Welcome back"}</h2>
              <p className="text-zinc-500 text-sm mt-1">{isRegistering ? "Please enter details to sign up" : "Please enter your details to sign in"}</p>
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-full flex justify-center">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google Sign-In Failed")} theme="outline" size="large" shape="pill" width="350" text="continue_with" />
              </div>
            </div>
            <div className="relative flex py-1 items-center mb-6">
              <div className="grow border-t border-zinc-100"></div>
              <span className="shrink-0 mx-3 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">OR</span>
              <div className="grow border-t border-zinc-100"></div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 ml-1">Username or Email</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-white border border-zinc-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-zinc-300 hover:border-zinc-300" placeholder="Enter your username" required />
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-zinc-700 ml-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white border border-zinc-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-zinc-300 hover:border-zinc-300 pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-zinc-400 hover:text-black transition">{showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}</button>
                </div>
              </div>
              {!isRegistering && (
                <div className="flex justify-between items-center text-xs mt-2 px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-500 hover:text-zinc-800 transition">
                    <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" /> Remember me
                  </label>
                  <button type="button" className="font-semibold text-zinc-900 hover:underline">Forgot password?</button>
                </div>
              )}
              {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}
              {successMsg && <p className="text-green-600 text-xs font-bold text-center mt-2">{successMsg}</p>}
              <button disabled={loading} className="w-full bg-zinc-900 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide hover:bg-black hover:shadow-lg hover:shadow-zinc-900/20 active:scale-[0.99] transition-all duration-200 mt-2">
                {loading ? <FaSpinner className="animate-spin mx-auto" /> : (isRegistering ? "Create account" : "Sign in")}
              </button>
            </form>
            <div className="mt-8 text-center text-sm text-zinc-500">
              {isRegistering ? "Already have an account?" : "Don't have an account?"}
              <button onClick={() => { setIsRegistering(!isRegistering); setError(""); setSuccessMsg(""); }} className="ml-1.5 font-bold text-zinc-900 hover:underline">{isRegistering ? "Sign in" : "Sign up"}</button>
            </div>
          </div>
        </motion.div>
      </div>
    </GoogleOAuthProvider>
  )
}

export default LoginModal