-- Reference data for KNOT. Safe to run more than once.

insert into public.institutions (name, email_domain)
values ('IIT Gandhinagar', 'iitgn.ac.in')
on conflict (email_domain) do nothing;

-- The live map only works inside the campus outline (see the campus_outline, campus_tolerance and map_radius migrations): anywhere within 1.5 km of the campus centre, or inside the outline.
update public.institutions
set map_bounds = '{"south": 23.2045, "north": 23.2204, "west": 72.6811, "east": 72.6952, "center_lat": 23.2112, "center_lng": 72.6866, "radius_m": 1500, "polygon": [[23.2204, 72.6873], [23.2204, 72.6931], [23.218, 72.6952], [23.2142, 72.6935], [23.2117, 72.6922], [23.20906, 72.69083], [23.20577, 72.68855], [23.2045, 72.6865], [23.2045, 72.68394], [23.20718, 72.68305], [23.20883, 72.68113], [23.21212, 72.68113], [23.21447, 72.68279], [23.2165, 72.6843], [23.2185, 72.686]]}'::jsonb
where email_domain = 'iitgn.ac.in' and map_bounds is null;

-- Shared office, club, committee and event addresses that must not sign up.
-- Patterns use SQL LIKE syntax against the part before the @.
insert into public.blocked_email_patterns (institution_id, pattern, note)
select i.id, p.pattern, p.note
from public.institutions i
cross join (values
  ('dean%', 'Dean offices'),
  ('registrar%', 'Registrar office'),
  ('director%', 'Director office'),
  ('office%', 'Generic offices'),
  ('admin%', 'Administration'),
  ('hod%', 'Heads of department'),
  ('secy%', 'Secretaries'),
  ('secretary%', 'Secretaries'),
  ('council%', 'Student councils'),
  ('club%', 'Clubs'),
  ('fest%', 'Festivals'),
  ('noreply%', 'System senders'),
  ('no-reply%', 'System senders'),
  ('helpdesk%', 'Help desks'),
  ('info', 'Generic info'),
  ('caa', 'Shared address'),
  ('cdsteam', 'Shared address'),
  ('hostel%', 'Hostel offices'),
  ('placement%', 'Placement office'),
  ('library%', 'Library')
) as p(pattern, note)
where i.email_domain = 'iitgn.ac.in'
on conflict (institution_id, pattern) do nothing;

insert into public.interests (name) values
  ('AI / ML'), ('Robotics'), ('Startups'), ('Hackathons'), ('Web dev'), ('Design'),
  ('Research'), ('Quizzing'), ('Debate'), ('Music'), ('Dance'), ('Theatre'),
  ('Photography'), ('Film'), ('Reading'), ('Writing'), ('Football'), ('Cricket'),
  ('Badminton'), ('Basketball'), ('Running'), ('Gym'), ('Chess'), ('Board games'),
  ('Video games'), ('Anime'), ('Cooking'), ('Travel'), ('Volunteering'), ('Late-night chai')
on conflict (name) do nothing;

-- Subdomains whose addresses also belong to IITGN students.
update public.institutions
set extra_domains = array['caa.iitgn.ac.in']
where email_domain = 'iitgn.ac.in';
