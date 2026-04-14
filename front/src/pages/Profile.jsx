import "../styles/ProfileCard.css";
import editIcon from "../assets/edit.svg";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchMapPlaces } from "../api/places";
import TabBar from "../components/TabBar/TabBar";
import ProfileCover from "../components/profile/ProfileCover";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import ProfileInfo from "../components/profile/ProfileInfo";
import EditProfileModal from "../components/profile/EditProfileModal";
import ProfileBadgePanel from "../components/profile/ProfileBadgePanel";
import ProfileMapPrivacyPanel from "../components/profile/ProfileMapPrivacyPanel";
import ProfileAdvisorPanel from "../components/profile/ProfileAdvisorPanel";
import AdvisorModal from "../components/profile/AdvisorModal";
import { useAdvisor } from "../hooks/useAdvisor";
import { useProfile } from "../hooks/useProfile";
import { loadTripCategories } from "../service/placeService";

const PROFILE_TABS = [
  { id: "bio", label: "Bio" },
  { id: "map", label: "Map" },
  { id: "trip advisor", label: "Trip Advisor" },
  { id: "traveler badge", label: "Traveler Badge" },
];

export default function ProfileCard() {
  const { t } = useTranslation();
  const profile = useProfile();
  const advisor = useAdvisor();
  const [activeTab, setActiveTab] = useState("bio");
  const [mapPlaces, setMapPlaces] = useState([]);
  const [tripCategories, setTripCategories] = useState([]);

  useEffect(() => {
    const loadMap = async () => {
      try {
        const places = await fetchMapPlaces();
        setMapPlaces(Array.isArray(places) ? places : []);
      } catch {
        setMapPlaces([]);
      }
    };

    loadMap();
  }, []);

  useEffect(() => {
    loadTripCategories({ setTripCategories });
  }, []);

  return (
    <div className="profile-wrapper">
      <ProfileCover cover={profile.cover} onCoverChange={profile.handleCoverChange} />

      <div className="profile-content profile-content--tabs">
        <div className="profilePage__header">
          <ProfileAvatar avatar={profile.avatar} defaultAvatar={profile.defaultAvatar} />

          <div className="profilePage__headerMeta">
            <span className="profilePage__eyebrow">{profile.user?.role || "USER"}</span>
            <h1 className="profilePage__title">{profile.username}</h1>
            <p className="profilePage__subtitle">{profile.email}</p>
          </div>
        </div>

        <TabBar
          tabs={PROFILE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="profilePage__tabBar"
        />

        <div className="tab-content">
          {activeTab === "bio" && (
            <section className="profilePage__tabContent fade-in">
              <div className="profilePage__panelCard profilePage__panelCard--bio">

                <div className="profilePage__bioTopRow">
                  <h2 className="profilePage__bio">{t("profile.bio")}</h2>
                  <button type="button" className="edit edit--button" onClick={profile.openEditModal}>
                    <img src={editIcon} alt={t("common.edit")} width="25" height="25" />
                  </button>
                </div>

                <ProfileInfo
                  email={profile.email}
                  username={profile.username}
                  travelStyle={profile.travelStyle}
                  user={advisor.user}
                  advisorStatus={advisor.advisorStatus}
                  advisorSuccess={advisor.advisorSuccess}
                  latestApplication={advisor.latestApplication}
                  privacySettings={profile.privacySettings}
                  privacySaving={profile.privacySaving}
                  onPrivacyChange={profile.updatePrivacySetting}
                  onOpenAdvisorModal={() => advisor.setAdvisorModalOpen(true)}
                  onLogout={profile.handleLogout}
                  showIdentity={false}
                  showAdvisorSection={false}
                  showTravelerBadgeSection={false}
                  showPrivacySection={false}
                  showEmail
                  showUsername={false}
                  emailLabel={t("profile.contact", { defaultValue: t("profile.contactInfo") })}
                />
              </div>
            </section>
          )}

          {activeTab === "map" && (
            <section className="profilePage__tabContent fade-in">
              <div className="profilePage__panelCard">
                <ProfileMapPrivacyPanel
                  privacySettings={profile.privacySettings}
                  privacySaving={profile.privacySaving}
                  onPrivacyChange={profile.updatePrivacySetting}
                  t={t}
                />
              </div>
            </section>
          )}

          {activeTab === "trip advisor" && (
            <section className="profilePage__tabContent fade-in">
              <div className="profilePage__panelCard">
                <ProfileAdvisorPanel
                  user={advisor.user}
                  advisorStatus={advisor.advisorStatus}
                  onOpenAdvisorModal={() => advisor.setAdvisorModalOpen(true)}
                  t={t}
                />
              </div>
            </section>
          )}

          {activeTab === "traveler badge" && (
            <section className="profilePage__tabContent fade-in">
              <div className="profilePage__panelCard">
                {/* <ProfileBadgeSummary places={mapPlaces} t={t} /> */}
                <ProfileBadgePanel places={mapPlaces} t={t} />
              </div>
            </section>
          )}
        </div>
      </div>

      {profile.isEditOpen && (
        <EditProfileModal
          tempUsername={profile.tempUsername}
          tempStyle={profile.tempStyle}
          tempAvatar={profile.tempAvatar}
          defaultAvatar={profile.defaultAvatar}
          setTempUsername={profile.setTempUsername}
          setTempStyle={profile.setTempStyle}
          setTempAvatar={profile.setTempAvatar}
          setAvatarFile={profile.setAvatarFile}
          onSave={profile.saveChanges}
          onClose={() => profile.setIsEditOpen(false)}
          fileToBase64={profile.fileToBase64}
        />
      )}

      {advisor.advisorModalOpen && (
        <AdvisorModal
          advisorForm={advisor.advisorForm}
          setAdvisorForm={advisor.setAdvisorForm}
          advisorLoading={advisor.advisorLoading}
          tripCategories={tripCategories}
          advisorError={advisor.advisorError}
          onSubmit={advisor.submitAdvisorApplication}
          onClose={() => advisor.setAdvisorModalOpen(false)}
        />
      )}
    </div>
  );
}
