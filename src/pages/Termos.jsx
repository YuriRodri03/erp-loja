import { Link } from 'react-router-dom';

export default function Termos() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 pt-28">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-gray-100">
        <div className="mb-8 border-b border-gray-100 pb-8">
          <Link to="/" className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2 mb-6">
            ← Voltar para o Início
          </Link>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Termos de Serviço</h1>
          <p className="text-gray-500">Última atualização: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="space-y-8 text-gray-600 text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar nosso Sistema de Gestão GIRO ("SaaS"), você concorda em cumprir e ser regido por estes Termos de Serviço. Caso não concorde com qualquer parte destes termos, o uso do sistema é expressamente proibido. O sistema destina-se a facilitar a organização comercial e financeira de pequenos negócios.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Descrição e Disponibilidade do Serviço</h2>
            <p>O sistema fornece uma interface web interativa. Nós não possuímos um banco de dados centralizado com as suas informações financeiras; nosso software atua como uma ponte, gerando e lendo planilhas diretamente no seu Google Drive pessoal. Nós nos esforçamos para manter a plataforma online 24/7, porém não garantimos disponibilidade ininterrupta, isentando-nos de responsabilidade por instabilidades de servidores de terceiros (como Google ou provedores de hospedagem).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Pagamentos, Assinaturas e Reembolsos</h2>
            <p>O serviço é cobrado de forma antecipada (pré-paga) através de planos selecionados pelo usuário. Todo o processamento financeiro é terceirizado (via InfinitePay). Em caso de inadimplência, o acesso ao painel do sistema será suspenso, mas seus arquivos no Google Drive permanecerão intactos. Não oferecemos reembolso por meses parcialmente utilizados.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Propriedade Intelectual e Uso Indevido</h2>
            <p>O código-fonte, design, marca e interfaces do sistema são de nossa propriedade exclusiva. É estritamente proibido realizar engenharia reversa, copiar a interface ou usar o sistema para facilitar a venda de produtos ilícitos, pirataria ou fraudes. A violação desta cláusula resultará em banimento imediato sem aviso prévio.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Isenção e Limitação de Responsabilidade</h2>
            <p>Você compreende que é o único responsável pelos dados que insere no sistema. Não nos responsabilizamos por perdas financeiras, erros de estoque, exclusão acidental de arquivos do seu Drive ou quebras de sigilo oriundas do compartilhamento indevido da sua própria conta do Google.</p>
          </section>
        </div>
      </div>
    </div>
  );
}