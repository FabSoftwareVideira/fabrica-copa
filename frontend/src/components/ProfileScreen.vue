<template>
  <div class="profile-container">
    <h2 class="profile-title">Perfil do Usuário</h2>
    <div v-if="loading" class="loading">Carregando...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="profile-avatar">
        <span class="profile-avatar-icon">{{ (profile.name && profile.name.length > 0) ? profile.name.charAt(0).toUpperCase() : '👤' }}</span>
      </div>
      <div class="profile-info-list">
        <div class="profile-field"><strong>Nome:</strong> <span>{{ profile.name }}</span></div>
        <div class="profile-field"><strong>Email:</strong> <span>{{ profile.email }}</span></div>
        <div class="profile-field"><strong>Função:</strong> <span class="profile-role">{{ profile.role }}</span></div>
        <div class="profile-field"><strong>Data de cadastro:</strong> <span>{{ formatDate(profile.createdAt) }}</span></div>
        <div class="profile-field profile-emails">
          <label class="profile-checkbox-label">
            <input type="checkbox" v-model="wantsEmails" @change="updateEmailPref" />
            Receber notificações por e-mail
          </label>
          <span v-if="savingPref" class="saving">Salvando...</span>
        </div>
        <div class="profile-field" v-if="profile.isBlocked">
          <span class="blocked">Usuário bloqueado</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  apiFetch: { type: Function, required: true }
});

const profile = ref({});
const wantsEmails = ref(false);
const loading = ref(true);
const error = ref('');
const savingPref = ref(false);

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

async function fetchProfile() {
  loading.value = true;
  error.value = '';
  try {
    const data = await props.apiFetch('/profile');
    profile.value = data;
    wantsEmails.value = !!data.wantsEmails;
  } catch (e) {
    error.value = e.message || 'Erro desconhecido';
  } finally {
    loading.value = false;
  }
}

async function updateEmailPref() {
  savingPref.value = true;
  try {
    await props.apiFetch('/profile/email-preference', {
      method: 'PATCH',
      body: JSON.stringify({ wantsEmails: wantsEmails.value })
    });
    profile.value.wantsEmails = wantsEmails.value;
  } catch (e) {
    error.value = e.message || 'Erro ao salvar preferência';
  } finally {
    savingPref.value = false;
  }
}

onMounted(fetchProfile);
</script>

<style scoped>
/* --- NOVO ESTILO --- */
.profile-container {
  max-width: 370px;
  margin: 2.5rem auto;
  padding: 2.2rem 2rem 2rem 2rem;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.profile-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.2rem;
  color: #1f2937;
}
.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f3f4f6 60%, #e0e7ef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.7rem;
  margin-bottom: 1.2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  color: #10a3ae;
  font-weight: 700;
  letter-spacing: 1px;
}
.profile-info-list {
  width: 100%;
}
.profile-field {
  margin-bottom: 1.1rem;
  display: flex;
  align-items: center;
  font-size: 1.05rem;
  color: #222;
}
.profile-field strong {
  min-width: 110px;
  font-weight: 600;
  color: #444;
}
.profile-field span {
  flex: 1;
}
.profile-role {
  background: #e0f7fa;
  color: #10a3ae;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 0.98em;
  font-weight: 600;
  margin-left: 2px;
}
.profile-emails {
  align-items: center;
  gap: 0.5rem;
}
.profile-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}
.loading, .saving {
  color: #888;
  font-size: 0.97em;
}
.error {
  color: #c00;
  margin-bottom: 1rem;
}
.blocked {
  color: #c00;
  font-weight: bold;
  margin-top: 0.5rem;
}
/* --- FIM NOVO ESTILO --- */
</style>
