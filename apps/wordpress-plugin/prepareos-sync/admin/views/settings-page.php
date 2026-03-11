<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap">
	<h1>PrepareOS Sync</h1>
	<p class="description">
		Connectez votre boutique WooCommerce a PrepareOS pour synchroniser les commandes.
	</p>

	<?php if ( $connection_success ) : ?>
	<div class="notice notice-success is-dismissible" style="padding: 10px;">
		<strong>&#10003; Connexion a PrepareOS reussie !</strong>
	</div>
	<?php endif; ?>

	<?php if ( $connection_error ) : ?>
	<div class="notice notice-error is-dismissible" style="padding: 10px;">
		<strong>&#10007; Echec de connexion :</strong> <?php echo esc_html( $connection_error ); ?>
	</div>
	<?php endif; ?>

	<form method="post" action="options.php">
		<?php settings_fields( 'prepareos_sync_settings' ); ?>

		<table class="form-table" role="presentation">
			<tr>
				<th scope="row">
					<label for="prepareos_api_url">URL PrepareOS</label>
				</th>
				<td>
					<input
						type="url"
						id="prepareos_api_url"
						name="<?php echo esc_attr( PrepareOS_Admin::OPTION_API_URL ); ?>"
						value="<?php echo esc_attr( $api_url ); ?>"
						class="regular-text"
						placeholder="https://api.prepareos.com"
					/>
					<p class="description">L'adresse de votre serveur PrepareOS.</p>
				</td>
			</tr>
			<tr>
				<th scope="row">
					<label for="prepareos_api_key">Cle API</label>
				</th>
				<td>
					<input
						type="text"
						id="prepareos_api_key"
						name="<?php echo esc_attr( PrepareOS_Admin::OPTION_API_KEY ); ?>"
						value="<?php echo esc_attr( $api_key ); ?>"
						class="regular-text"
						placeholder="sk_..."
					/>
					<p class="description">
						Copiez la cle depuis PrepareOS &rarr; Parametres &rarr; WooCommerce.
					</p>
				</td>
			</tr>
		</table>

		<?php submit_button( 'Enregistrer et connecter' ); ?>
	</form>

	<hr />
	<p class="description">
		La synchronisation des categories et produits se fait depuis l'interface PrepareOS
		(Parametres &rarr; WooCommerce &rarr; Synchroniser).
	</p>
</div>
