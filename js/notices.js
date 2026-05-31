import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import { fetchAnnouncements, insertAnnouncement, deleteAnnouncement } from './api.js';
import { showToast, escapeHtml, formatDate } from './utils.js';

function renderNotices(list, isAdmin) {
  const ul = document.getElementById('notice-list');
  const empty = document.getElementById('notice-empty');
  if (!ul) return;

  if (!list.length) {
    ul.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  ul.innerHTML = list
    .map(
      (n) => `
    <li class="notice-item ${n.is_pinned ? 'notice-item--pinned' : ''}">
      <div class="notice-item__head">
        <h3>${escapeHtml(n.title)}</h3>
        <time datetime="${n.created_at}">${formatDate(n.created_at)}</time>
      </div>
      <p>${escapeHtml(n.body)}</p>
      ${
        isAdmin
          ? `<button type="button" class="btn btn--danger btn--sm btn-delete-notice" data-id="${n.id}">Delete</button>`
          : ''
      }
    </li>
  `
    )
    .join('');

  if (isAdmin) {
    ul.querySelectorAll('.btn-delete-notice').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('Delete this notice?')) return;
        const { error } = await deleteAnnouncement(btn.dataset.id);
        if (error) {
          showToast(error.message, 'error');
          return;
        }
        showToast('Notice deleted.', 'success');
        await loadNotices(isAdmin);
      });
    });
  }
}

async function loadNotices(isAdmin) {
  const { data, error } = await fetchAnnouncements();
  if (error) {
    showToast(error.message || 'Could not load notices.', 'error');
    return;
  }
  renderNotices(data || [], isAdmin);
}

export async function initNoticesPage() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getUserProfile();
  const isAdmin = isAdminRole(profile?.role);
  const formWrap = document.getElementById('admin-notice-form-wrap');
  if (formWrap) formWrap.hidden = !isAdmin;

  await loadNotices(isAdmin);

  const form = document.getElementById('notice-form');
  if (form && isAdmin) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = form.title.value.trim();
      const body = form.body.value.trim();
      if (!title || !body) {
        showToast('Title and message are required.', 'error');
        return;
      }
      const { error } = await insertAnnouncement({
        title,
        body,
        is_pinned: form.is_pinned.checked,
      });
      if (error) {
        showToast(error.message, 'error');
        return;
      }
      form.reset();
      showToast('Notice published.', 'success');
      await loadNotices(isAdmin);
    });
  }
}
