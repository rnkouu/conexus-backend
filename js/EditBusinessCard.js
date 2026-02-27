const { useState } = React;

/* ==========================================
   1. The Display Card (EXPANDED SOCIAL VERSION)
   ========================================== */
const DigitalBusinessCard = ({ user }) => {
  // Ensure name is always a string to prevent .replace() errors
  const name = user?.full_name || user?.name || "Participant";
  const job = user?.job_title || "";
  const designation = user?.designation || ""; 
  const org = user?.university_org || user?.university || "";
  const bio = user?.bio || "";
  const email = user?.email || "";
  const phone = user?.phone || "";
  
  // Social Links
  const linkedin = user?.linkedin_url || "";
  const facebook = user?.facebook_url || "";
  const twitter = user?.twitter_url || "";

  const getInitial = () => {
    if (name && typeof name === 'string' && name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    return "?";
  };

  const handleSaveContact = () => {
    // Safety check for filename
    const safeName = (name || "Contact").replace(/\s+/g, '_');
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTITLE:${job}\nORG:${org}\nNOTE:${bio}\nEMAIL:${email}\nTEL:${phone}\nURL:${linkedin}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="u-card rounded-[2.5rem] w-full max-w-[350px] mx-auto bg-white overflow-hidden relative shadow-2xl border border-gray-100 transition-all">
      {/* Institutional Top Bar */}
      <div className="h-28 bg-[#061f38] relative flex items-center justify-center">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '12px 12px'}}></div>
        <div className="absolute -bottom-12 w-24 h-24 rounded-3xl bg-white p-1.5 shadow-xl">
           <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#061f38] to-[#1e5aa8] flex items-center justify-center text-white text-4xl font-black">
              {getInitial()}
           </div>
        </div>
      </div>

      <div className="pt-16 pb-8 px-8 text-center">
        <h1 className="text-2xl font-black text-[#061f38] mb-1">{name}</h1>
        <p className="text-[11px] text-[#1e5aa8] font-black uppercase tracking-widest mb-1">
          {job || "Professional Title"}
        </p>
        <p className="text-[10px] text-gray-400 font-bold uppercase italic mb-4">
          {designation || "Academic Designation"}
        </p>
        
        <div className="bg-[#f3f7ff] rounded-2xl p-3 mb-6 border border-[#e8f1ff]">
           <p className="text-[10px] font-black text-[#061f38] opacity-60 uppercase tracking-tighter mb-1">Organization / University</p>
           <p className="text-xs font-black text-[#061f38]">{org || "Institution Name"}</p>
        </div>

        <button 
          onClick={handleSaveContact} 
          className="grad-btn w-full text-white py-3.5 rounded-2xl font-black text-[11px] mb-6 shadow-lg u-sweep relative overflow-hidden transition-transform active:scale-95"
        >
          SAVE TO CONTACTS
        </button>

        {/* Contact & Social Grid - Only shows if data exists */}
        <div className="flex justify-center flex-wrap gap-3 mb-6">
          {email && (
            <a href={`mailto:${email}`} title="Email" className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 text-[#061f38] hover:bg-[#061f38] hover:text-white transition-all shadow-sm border border-gray-100">
              <span className="text-lg">✉</span>
            </a>
          )}
          {phone && (
            <a href={`tel:${phone}`} title="Phone" className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 text-[#061f38] hover:bg-[#061f38] hover:text-white transition-all shadow-sm border border-gray-100">
              <span className="text-lg">📞</span>
            </a>
          )}
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 text-[#1e5aa8] hover:bg-[#1e5aa8] hover:text-white transition-all shadow-sm border border-gray-100">
              <span className="text-lg font-black text-[14px]">in</span>
            </a>
          )}
          {facebook && (
            <a href={facebook} target="_blank" rel="noreferrer" title="Facebook" className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-gray-100">
              <span className="text-lg font-black text-[14px]">f</span>
            </a>
          )}
          {twitter && (
            <a href={twitter} target="_blank" rel="noreferrer" title="Twitter" className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 text-sky-500 hover:bg-sky-500 hover:text-white transition-all shadow-sm border border-gray-100">
              <span className="text-lg font-black text-[14px]">𝕏</span>
            </a>
          )}
        </div>

        <div className="space-y-4 text-left border-t border-gray-100 pt-5">
          {bio && (
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#f5c518] mb-1">About Me</h3>
              <p className="text-xs text-gray-500 leading-relaxed italic line-clamp-4">"{bio}"</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#061f38] via-[#f5c518] to-[#1e5aa8] opacity-50"></div>
    </div>
  );
};

/* ==========================================
   2. The Edit Form UI (EXTENDED FIELDS)
   ========================================== */
function EditBusinessCard({ user, onUpdateUser }) {
  const [formData, setFormData] = useState({
    name: user?.name || user?.full_name || '',
    job_title: user?.job_title || '',
    designation: user?.designation || '',
    university_org: user?.university_org || user?.university || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    linkedin_url: user?.linkedin_url || '',
    facebook_url: user?.facebook_url || '',
    twitter_url: user?.twitter_url || '' 
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

 const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        const token = localStorage.getItem('conexus_token'); 
        const response = await fetch('https://conexus-backend-production.up.railway.app/api/users/profile', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ email: user.email, ...formData })
        });
        const data = await response.json();
        if (data.success) {
            window.Swal.fire({ title: 'Saved!', text: 'Institutional profile updated!', icon: 'success', timer: 2000, showConfirmButton: false });
            if (onUpdateUser) onUpdateUser({ ...user, ...formData });
        } else {
            window.Swal.fire({ title: 'Update Failed', text: data.message || "Failed to update profile.", icon: 'error', confirmButtonColor: '#1e5aa8' });
        }
    } catch (error) {
        window.Swal.fire({ title: 'Error', text: 'Error saving card.', icon: 'error', confirmButtonColor: '#1e5aa8' });
    } finally {
        setIsSaving(false);
    }
  };

  const labelCls = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1";
  const inputCls = "w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm focus:border-[#1e5aa8] focus:ring-4 focus:ring-[#1e5aa8]/5 outline-none transition-all placeholder:text-gray-300";

  return (
    <div className="grid lg:grid-cols-2 gap-10 items-start py-6 animate-fade-in-up">
      {/* Left Column: Form */}
      <div className="u-card p-8 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm">
        <div className="mb-8 border-b border-gray-50 pb-6">
          <h2 className="text-3xl font-black text-[#061f38] tracking-tight">Profile Settings</h2>
          <p className="text-sm text-gray-400 mt-1">Configure your digital NFC identity.</p>
        </div>
        
        <form onSubmit={handleSave} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div>
               <label className={labelCls}>Display Name</label>
               <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputCls} placeholder="Dr. John Doe" />
             </div>
             <div>
               <label className={labelCls}>Professional Title</label>
               <input type="text" name="job_title" value={formData.job_title} onChange={handleChange} className={inputCls} placeholder="Lead Researcher" />
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div>
               <label className={labelCls}>Designation</label>
               <input type="text" name="designation" value={formData.designation} onChange={handleChange} className={inputCls} placeholder="Senior Faculty" />
             </div>
             <div>
               <label className={labelCls}>Contact Number</label>
               <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inputCls} placeholder="+63 9xx xxx xxxx" />
             </div>
           </div>
           
           <div>
             <label className={labelCls}>University / Organization</label>
             <input type="text" name="university_org" value={formData.university_org} onChange={handleChange} className={inputCls} placeholder="Academic Institution" />
           </div>

           <div className="space-y-4 pt-4 border-t border-gray-50">
             <h4 className="text-[11px] font-black text-brand uppercase tracking-[0.2em]">Social Connectivity (Optional)</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <input type="url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} className={inputCls} placeholder="LinkedIn URL" />
               <input type="url" name="facebook_url" value={formData.facebook_url} onChange={handleChange} className={inputCls} placeholder="Facebook URL" />
               <input type="url" name="twitter_url" value={formData.twitter_url} onChange={handleChange} className={inputCls} placeholder="Twitter / X URL" />
             </div>
           </div>
           
           <div>
             <label className={labelCls}>About / Bio</label>
             <textarea name="bio" value={formData.bio} onChange={handleChange} className={inputCls} placeholder="Brief academic summary..." rows="3" />
           </div>

           <button 
             type="submit" 
             disabled={isSaving} 
             className="grad-btn w-full text-white py-4 rounded-2xl font-black text-sm u-sweep relative overflow-hidden shadow-2xl transition-all active:scale-[0.98]"
           >
             {isSaving ? "SYNCING..." : "SAVE & PUBLISH CARD"}
           </button>
        </form>
      </div>

      {/* Right Column: Live Preview */}
      <div className="sticky top-6 flex flex-col items-center justify-center p-12 bg-gradient-to-b from-[#f3f7ff] to-white rounded-[3.5rem] border-2 border-dashed border-[#e8f1ff]">
        <div className="mb-8 flex flex-col items-center">
          <span className="px-4 py-1.5 bg-white rounded-full text-[10px] font-black text-[#1e5aa8] uppercase tracking-[0.3em] shadow-sm border border-blue-50">
            Live NFC Preview
          </span>
        </div>
        <DigitalBusinessCard user={{ ...user, ...formData }} />
        <div className="mt-8 flex items-center gap-3 text-[11px] text-gray-400 font-bold bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-50">
           <span className="text-emerald-500 animate-pulse">●</span> Real-time Sync Active
        </div>
      </div>
    </div>
  );
}

// MAKE GLOBAL
window.DigitalBusinessCard = DigitalBusinessCard;
window.EditBusinessCard = EditBusinessCard;