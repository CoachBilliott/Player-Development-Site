import { staffProfiles, type PublicStaffProfile } from "./staffProfiles";
import "./meetTheStaff.css";

export function MeetTheStaff({
  profiles = staffProfiles,
}: {
  profiles?: PublicStaffProfile[];
}) {
  return (
    <main className="meet-staff">
      <section className="staff-intro" aria-labelledby="staff-title">
        <div>
          <p className="staff-eyebrow">REPFORMED / OUR PEOPLE</p>
          <h1 id="staff-title" tabIndex={-1}>
            Meet the staff<span>Purpose in every rep.</span>
          </h1>
        </div>
        <p className="staff-intro-copy">
          Get to know the people behind Repformed and the work they do to
          support athletes and families.
        </p>
      </section>
      <section className="staff-grid" aria-label="Staff profiles">
        {profiles.map((profile) => (
          <article
            className="staff-card"
            key={profile.id}
            aria-labelledby={`${profile.id}-name`}
          >
            <div className="staff-photo">
              <img
                src={`${import.meta.env.BASE_URL}${profile.photo.src}`}
                alt={profile.photo.alt}
                width={profile.photo.width}
                height={profile.photo.height}
                style={{ objectPosition: profile.photo.objectPosition }}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="staff-details">
              <p className="staff-eyebrow">{profile.title}</p>
              <h2 id={`${profile.id}-name`}>{profile.name}</h2>
              <p className="staff-bio">{profile.bio}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
