import "../styles/ProfileCard.css";
import editIcon from "../assets/edit.svg";
import { useProfile } from "../hooks/useProfile";
import { useAdvisor } from "../hooks/useAdvisor";
import ProfileCover from "../components/profile/ProfileCover";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import ProfileInfo from "../components/profile/ProfileInfo";
import EditProfileModal from "../components/profile/EditProfileModal";
import AdvisorModal from "../components/profile/AdvisorModal";

export default function ProfileCard() {
  const profile = useProfile();
  const advisor = useAdvisor();

  return (
    <div className="profile-wrapper">
      <ProfileCover cover={profile.cover} onCoverChange={profile.handleCoverChange} />

      <div className="profile-content">
        <ProfileAvatar avatar={profile.avatar} defaultAvatar={profile.defaultAvatar} />

        <ProfileInfo
          email={profile.email} username={profile.username}
          travelStyle={profile.travelStyle} user={advisor.user}
          advisorStatus={advisor.advisorStatus} advisorSuccess={advisor.advisorSuccess}
          latestApplication={advisor.latestApplication}
          privacySettings={profile.privacySettings}
          privacySaving={profile.privacySaving}
          onPrivacyChange={profile.updatePrivacySetting}
          onOpenAdvisorModal={() => advisor.setAdvisorModalOpen(true)}
          onLogout={profile.handleLogout}
        />

        <div className="edit" onClick={profile.openEditModal}>
          <img src={editIcon} alt="Edit" width="28" height="28" />
        </div>
      </div>

      {profile.isEditOpen && (
        <EditProfileModal
          tempUsername={profile.tempUsername} tempStyle={profile.tempStyle}
          tempAvatar={profile.tempAvatar} defaultAvatar={profile.defaultAvatar}
          setTempUsername={profile.setTempUsername} setTempStyle={profile.setTempStyle}
          setTempAvatar={profile.setTempAvatar} setAvatarFile={profile.setAvatarFile}
          onSave={profile.saveChanges} onClose={() => profile.setIsEditOpen(false)}
          fileToBase64={profile.fileToBase64}
        />
      )}

      {advisor.advisorModalOpen && (
        <AdvisorModal
          advisorForm={advisor.advisorForm}
          setAdvisorForm={advisor.setAdvisorForm}
          advisorLoading={advisor.advisorLoading}
          advisorError={advisor.advisorError}
          onSubmit={advisor.submitAdvisorApplication}
          onClose={() => advisor.setAdvisorModalOpen(false)}
        />
      )}
    </div>
  );
}
