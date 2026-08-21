import { Link } from 'react-router-dom';

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 pt-28">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-gray-100">
        <div className="mb-8 border-b border-gray-100 pb-8">
          <Link to="/" className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2 mb-6">
            ← Voltar para o Início
          </Link>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Políticas de Privacidade</h1>
          <p className="text-gray-500">Última atualização: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="space-y-8 text-gray-600 text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Coleta de Dados e Login do Google</h2>
            <p>O <strong>GIRO</strong> utiliza o serviço de autenticação do Google (Google OAuth) para permitir o seu acesso. Durante o login, coletamos exclusivamente o seu endereço de e-mail. Não armazenamos senhas ou dados pessoais secundários.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Por que solicitamos acesso ao seu Google Drive?</h2>
            <p>A funcionalidade principal do nosso sistema é o armazenamento descentralizado. Solicitamos as permissões (escopos) <code>drive.file</code> e <code>spreadsheets</code> com o único propósito de <strong>criar e gerenciar planilhas que servem como banco de dados do seu próprio negócio, diretamente na sua conta.</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Uso e Limites dos Dados do Google (Uso Restrito)</h2>
            <p>A nossa aplicação <strong>NÃO</strong> tem permissão para acessar, ler ou modificar nenhuma outra foto, PDF, documento ou planilha do seu Google Drive que não tenha sido criada pelo próprio sistema GIRO. Nós não lemos, não transferimos, não vendemos e não processamos seus dados financeiros em servidores de terceiros; tudo permanece no seu ambiente Google.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Exclusão de Dados</h2>
            <p>Como os dados comerciais residem exclusivamente no seu próprio Google Drive, você pode excluí-los a qualquer momento apagando a planilha "Base de Dados" da sua conta do Google. Para excluir sua conta no nosso sistema, entre em contato através dos canais oficiais na página inicial.</p>
          </section>
        </div>
      </div>
    </div>
  );
}