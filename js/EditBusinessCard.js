const { useState } = React;

/* ==========================================
   1. The Display Card (SAFE MASTER VERSION)
   ========================================== */
const DigitalBusinessCard = ({ user }) => {
  const name = user?.full_name || user?.name || "";
  const job = user?.job_title || "";
  const org = user?.university_org || user?.university || "";
  const bio = user?.bio || "";
  const skills = user?.skills || "";
  const linkedin = user?.linkedin_url || "";
  const email = user?.email || "";

  // This is the FIX for the charAt crash
  const getInitial = () => {
    if (name && typeof name === 'string' && name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    return "?";
  };

  const handleSaveContact = () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTITLE:${job}\nORG:${org}\nNOTE:${bio}\nEMAIL:${email}\nURL:${linkedin}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/\s+/g, '_')}_Contact.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const skillArray = (skills && typeof skills === 'string') ? skills.split(',') : [];

  return (
    <div className="u-card p-6 rounded-3xl w-full max-w-[340px] mx-auto bg-white shadow-xl border border-gray-100">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-[#002147] text-white text-3xl flex items-center justify-center mx-auto mb-4 font-black shadow-lg">
          {getInitial()}
        </div>
        <h1 className="text-xl font-black text-[#002147] mb-1">{name || "Your Name"}</h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          {job || "Job Title"} {org && `• ${org}`}
        </p>
      </div>
      <button onClick={handleSaveContact} className="grad-btn w-full text-white py-3 rounded-2xl font-black text-[10px] mb-6 shadow-md relative overflow-hidden">
        SAVE TO CONTACTS
      </button>
      <div className="space-y-4 text-left">
        {bio && (
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#002147] mb-1">About</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{bio}</p>
          </div>
        )}
        <div className="pt-3 border-t border-gray-100">
           <p className="text-[11px] text-gray-600 font-bold">📧 {email || "Email not set"}</p>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   2. The Edit Form UI
   ========================================== */
function EditBusinessCard({ user, onUpdateUser }) {
  const [formData, setFormData] = useState({
    job_title: user?.job_title || '',
    university_org: user?.university_org || user?.university || '',
    bio: user?.bio || '',
    skills: user?.skills || '',
    linkedin_url: user?.linkedin_url || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
  e.preventDefault();
  setIsSaving(true);
  try {
    const response = await fetch('http://localhost:8000/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, ...formData })
    });
    const data = await response.json();
    if (data.success) {
      alert("Business card updated!");
      // This sends the new data back up to App.js
      if (onUpdateUser) onUpdateUser({ ...user, ...formData });
    }
  } catch (error) {
    alert("Error saving card.");
  } finally {
    setIsSaving(false);
  }
};

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start py-4 animate-fade-in-up">
      <div className="u-card p-6 md:p-8 rounded-3xl">
        <h2 className="text-2xl font-black text-[#002147] mb-2">Networking Card</h2>
        <form onSubmit={handleSave} className="grid gap-4">
           <input type="text" name="job_title" value={formData.job_title} onChange={handleChange} className="w-full rounded-xl border p-2 text-sm" placeholder="Job Title" />
           <input type="text" name="university_org" value={formData.university_org} onChange={handleChange} className="w-full rounded-xl border p-2 text-sm" placeholder="Organization" />
           <textarea name="bio" value={formData.bio} onChange={handleChange} className="w-full rounded-xl border p-2 text-sm" placeholder="Short Bio" rows="3" />
           <button type="submit" className="grad-btn w-full text-white py-3 rounded-2xl font-black">SAVE CHANGES</button>
        </form>
      </div>
      <div className="flex flex-col items-center justify-center p-8 bg-blue-50/30 rounded-3xl border border-dashed border-blue-200">
        <DigitalBusinessCard user={{ ...user, ...formData }} />
      </div>
    </div>
  );
}

// MAKE GLOBAL
window.DigitalBusinessCard = DigitalBusinessCard;
window.EditBusinessCard = EditBusinessCard;