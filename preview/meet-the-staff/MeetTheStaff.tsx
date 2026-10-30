import type { PublicStaffProfile } from "./profiles";

export function MeetTheStaff({ profiles }: { profiles: PublicStaffProfile[] }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to staff profiles
      </a>
      <aside className="review-banner" aria-label="Preview status">
        LAYOUT REVIEW <span>Profile review · Not published</span>
      </aside>
      <header className="staff-header">
        <div className="staff-brand">
          <img src="./brand/repformed-mark.svg" width="48" height="40" alt="" />
          <div>
            REPFORMED<small>ATHLETE DEVELOPMENT</small>
          </div>
        </div>
        <span className="header-label">THE PEOPLE BEHIND THE PURPOSE</span>
      </header>
      <main id="main">
        <section className="staff-intro" aria-labelledby="staff-title">
          <div>
            <p className="eyebrow">REPFORMED / OUR PEOPLE</p>
            <h1 id="staff-title">
              Meet the staff<span>Purpose in every rep.</span>
            </h1>
          </div>
          <p className="intro-copy">
            Get to know the people behind Repformed and the work they do to
            support athletes and families.
          </p>
        </section>
        <section className="staff-grid" aria-label="Staff profiles">
          {profiles.map((profile, index) => (
            <article
              className="staff-card"
              key={profile.id}
              aria-labelledby={`${profile.id}-name`}
            >
              <div className="staff-photo">
                {profile.photo ? (
                  <img
                    src={profile.photo.src}
                    alt={profile.photo.alt}
                    width="1067"
                    height="1600"
                    style={{ objectPosition: profile.photo.objectPosition }}
                    loading="lazy"
                  />
                ) : (
                  <div className="photo-placeholder">
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p>
                      Headshot pending<small>Preview placeholder</small>
                    </p>
                  </div>
                )}
              </div>
              <div className="staff-details">
                <p className="eyebrow">{profile.title}</p>
                <h2 id={`${profile.id}-name`}>{profile.name}</h2>
                <p className="staff-bio">{profile.bio}</p>
                {profile.experience.length > 0 && (
                  <div className="staff-experience">
                    <h3>Relevant experience</h3>
                    <ul>
                      {profile.experience.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
        <section className="review-note" aria-labelledby="review-title">
          <p className="eyebrow">BEFORE PUBLICATION</p>
          <h2 id="review-title">Real people. Approved profiles.</h2>
          <p>
            Devyn’s biography uses his submitted questionnaire. His submitted
            sideline photo is included, and Victor’s profile is awaiting
            submission. All profiles remain unpublished until final review.
          </p>
        </section>
      </main>
      <footer className="staff-footer">
        <strong>REPFORMED</strong>
        <span>Meet the Staff · Private layout review</span>
      </footer>
    </>
  );
}
