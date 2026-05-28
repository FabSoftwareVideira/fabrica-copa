<template>
  <div class="profile-container">
    <h2>Perfil do Usuário</h2>
    <div v-if="loading" class="loading">Carregando...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="profile-field"><strong>Nome:</strong> {{ profile.name }}</div>
      <div class="profile-field"><strong>Email:</strong> {{ profile.email }}</div>
      <div class="profile-field"><strong>Função:</strong> {{ profile.role }}</div>
      <div class="profile-field"><strong>Data de cadastro:</strong> {{ formatDate(profile.createdAt) }}</div>
      <div class="profile-field">
        <label>
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
.profile-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.profile-field {
  margin-bottom: 1rem;
}
.loading, .saving {
  color: #888;
  font-size: 0.95em;
}
.error {
  color: #c00;
  margin-bottom: 1rem;
}
.blocked {
  color: #c00;
  font-weight: bold;
}
</style>
